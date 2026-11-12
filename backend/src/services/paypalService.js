import axios from 'axios';
import { assertPaypalConfigured, paypalConfig } from '../config/paypal.js';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  assertPaypalConfigured();
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const credentials = Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString('base64');
  const response = await axios.post(
    `${paypalConfig.baseUrl}/v1/oauth2/token`,
    'grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );
  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + Number(response.data.expires_in || 300) * 1000;
  return cachedToken;
}

async function paypalRequest(method, path, body, requestId) {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const response = await axios({ method, url: `${paypalConfig.baseUrl}${path}`, data: body, headers, timeout: 20000 });
  return response.data;
}

export function createPaypalOrder(order, requestId = order.id) {
  const origin = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
  return paypalRequest('post', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: String(order._id),
      custom_id: String(order.customerId),
      amount: { currency_code: order.currency, value: order.totalAmount.toFixed(2) },
      items: order.items.map(item => ({
        name: item.name.slice(0, 127),
        quantity: String(item.quantity),
        unit_amount: { currency_code: order.currency, value: item.unitPrice.toFixed(2) },
        category: 'PHYSICAL_GOODS',
      })),
      ...(order.shipping?.address ? { shipping: { name: { full_name: `${order.shipping.firstName || ''} ${order.shipping.lastName || ''}`.trim() }, address: { address_line_1: order.shipping.address, admin_area_2: order.shipping.city, postal_code: order.shipping.postalCode, country_code: countryCode(order.shipping.country) } } } : {}),
    }],
    application_context: { brand_name: 'SellerShield', user_action: 'PAY_NOW', return_url: `${origin}/checkout`, cancel_url: `${origin}/cart` },
  }, requestId);
}

function countryCode(country) {
  const codes = { 'United States': 'US', India: 'IN', 'United Kingdom': 'GB', Canada: 'CA' };
  return codes[country] || 'US';
}

export function capturePaypalOrder(paypalOrderId, requestId) {
  return paypalRequest('post', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {}, requestId || `capture-${paypalOrderId}`);
}

export function refundPaypalCapture(captureId, amount, currency, requestId) {
  return paypalRequest('post', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    amount: { value: Number(amount).toFixed(2), currency_code: currency },
  }, requestId);
}

export function verifyPaypalWebhook(headers, event) {
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];
  const transmissionSig = headers['paypal-transmission-sig'];
  if (!paypalConfig.webhookId || !transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    const error = new Error('PayPal webhook verification is not configured or headers are incomplete.');
    error.statusCode = 503;
    throw error;
  }
  return paypalRequest('post', '/v1/notifications/verify-webhook-signature', {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: paypalConfig.webhookId,
    webhook_event: event,
  });
}
