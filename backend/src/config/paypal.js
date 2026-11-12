export const paypalConfig = {
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  baseUrl: (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, ''),
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
  currency: process.env.PAYPAL_CURRENCY || 'USD',
};

export function assertPaypalConfigured() {
  if (!paypalConfig.clientId || !paypalConfig.clientSecret) {
    const error = new Error('PayPal is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }
}
