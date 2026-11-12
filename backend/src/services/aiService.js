import Groq from 'groq-sdk';
import mongoose from 'mongoose';
import { groqConfig } from '../config/groq.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

const tools = [
  { type: 'function', function: { name: 'search_products', description: 'Search active products in the real catalog. Product prices are stored in USD. For an INR budget, set currency to INR and the server converts it using its configured INR_PER_USD_RATE.', parameters: { type: 'object', properties: { keyword: { type: 'string' }, maxPrice: { type: 'number', minimum: 0 }, currency: { type: 'string', enum: ['USD', 'INR'] }, category: { type: 'string' } }, additionalProperties: false } } },
  { type: 'function', function: { name: 'get_product_details', description: 'Get verified details for one active catalog product.', parameters: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'compare_products', description: 'Compare two products that exist in the active catalog. Always fetch both records with this tool before comparing.', parameters: { type: 'object', properties: { productIds: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' } } }, required: ['productIds'], additionalProperties: false } } },
  { type: 'function', function: { name: 'prepare_cart', description: 'Add a verified in-stock product to this customer’s saved cart.', parameters: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['productId', 'quantity'], additionalProperties: false } } },
  { type: 'function', function: { name: 'get_order_status', description: 'Check an existing order visible to the signed-in customer or seller.', parameters: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'], additionalProperties: false } } },
  { type: 'function', function: { name: 'check_refund_eligibility', description: 'Check policy eligibility and request an AI refund recommendation. This never approves or executes a refund.', parameters: { type: 'object', properties: { orderId: { type: 'string' }, reason: { type: 'string' } }, required: ['orderId', 'reason'], additionalProperties: false } } },
];
let groqClient;

function getGroqClient() {
  if (!groqClient) groqClient = new Groq({ apiKey: groqConfig.apiKey, baseURL: groqConfig.baseUrl, timeout: 30000, maxRetries: 0 });
  return groqClient;
}

function jsonArgs(raw) {
  const value = JSON.parse(raw || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tool arguments must be a JSON object.');
  return value;
}

const productProjection = 'name description price category image stock';
const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
const requireKeys = (args, keys) => {
  if (!isPlainObject(args) || Object.keys(args).some(key => !keys.includes(key))) throw new Error('Tool arguments must be a JSON object with only supported fields.');
};

async function searchProducts(args) {
  requireKeys(args, ['keyword', 'category', 'maxPrice', 'currency']);
  const filter = { isActive: true };
  if (args.category !== undefined) {
    if (typeof args.category !== 'string' || args.category.length > 80) throw new Error('category must be a string of at most 80 characters.');
    filter.category = args.category.trim();
  }
  if (args.maxPrice !== undefined) {
    const maxPrice = Number(args.maxPrice);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) throw new Error('maxPrice must be a non-negative number.');
    const currency = args.currency || 'USD';
    if (!['USD', 'INR'].includes(currency)) throw new Error('Only USD and INR budgets are supported.');
    let usdMaxPrice = maxPrice;
    if (currency === 'INR') {
      const rupeesPerUsd = Number(process.env.INR_PER_USD_RATE);
      if (!Number.isFinite(rupeesPerUsd) || rupeesPerUsd <= 0) throw new Error('INR budget conversion is not configured. Ask for the budget in USD.');
      usdMaxPrice = maxPrice / rupeesPerUsd;
    }
    filter.price = { $lte: usdMaxPrice };
  }
  if (args.keyword !== undefined) {
    if (typeof args.keyword !== 'string' || args.keyword.length > 100) throw new Error('keyword must be a string of at most 100 characters.');
    if (args.keyword.trim()) filter.$text = { $search: args.keyword.trim() };
  }
  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(12).select(productProjection).lean();
  return products.map(product => ({ id: String(product._id), ...product }));
}

async function getProductDetails(args) {
  requireKeys(args, ['productId']);
  if (!mongoose.isValidObjectId(args.productId)) throw new Error('productId must be a valid catalog ID.');
  const product = await Product.findOne({ _id: args.productId, isActive: true }).select(productProjection).lean();
  if (!product) return { found: false, message: 'Product was not found in the active catalog.' };
  return { found: true, id: String(product._id), ...product };
}

async function compareProducts(args) {
  requireKeys(args, ['productIds']);
  if (!Array.isArray(args.productIds) || args.productIds.length !== 2 || args.productIds.some(id => !mongoose.isValidObjectId(id)) || args.productIds[0] === args.productIds[1]) {
    throw new Error('productIds must contain two different valid catalog IDs.');
  }
  const records = await Product.find({ _id: { $in: args.productIds }, isActive: true }).select(productProjection).lean();
  if (records.length !== 2) return { found: false, message: 'Both products must be active catalog records to compare.' };
  const byId = new Map(records.map(product => [String(product._id), { id: String(product._id), ...product }]));
  return { found: true, products: args.productIds.map(id => byId.get(id)) };
}

async function prepareCart(args, user) {
  requireKeys(args, ['productId', 'quantity']);
  if (user.role !== 'customer') throw new Error('Only customer accounts can prepare a shopping cart.');
  if (!mongoose.isValidObjectId(args.productId)) throw new Error('productId must be a valid catalog ID.');
  const quantity = Number(args.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('quantity must be an integer from 1 to 20.');
  const product = await Product.findOne({ _id: args.productId, isActive: true });
  if (!product) throw new Error('Product is not available.');
  const cart = await Cart.findOne({ userId: user._id });
  const existingQty = cart?.items.find(item => String(item.productId) === String(product._id))?.quantity || 0;
  if (existingQty + quantity > product.stock) throw new Error('There is not enough stock for that quantity.');
  if (cart) {
    const existing = cart.items.find(item => String(item.productId) === String(product._id));
    if (existing) existing.quantity += quantity;
    else cart.items.push({ productId: product._id, quantity });
    await cart.save();
  } else {
    await Cart.create({ userId: user._id, items: [{ productId: product._id, quantity }] });
  }
  return { added: true, product: { id: String(product._id), name: product.name, unitPrice: product.price }, quantityAdded: quantity };
}

async function getOrderStatus(args, user) {
  requireKeys(args, ['orderId']);
  if (!mongoose.isValidObjectId(args.orderId)) throw new Error('orderId must be a valid order ID.');
  const order = await Order.findById(args.orderId).lean();
  if (!order) return { found: false, message: 'Order was not found.' };
  const canView = user.role === 'customer'
    ? String(order.customerId) === String(user._id)
    : order.items.some(item => String(item.sellerId) === String(user._id));
  if (!canView) throw new Error('You are not authorized to view this order.');
  return { found: true, orderId: String(order._id), orderStatus: order.orderStatus, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount, currency: order.currency, createdAt: order.createdAt, items: order.items.map(item => ({ name: item.name, quantity: item.quantity })) };
}

async function checkRefundEligibility(args, user) {
  requireKeys(args, ['orderId', 'reason']);
  if (user.role !== 'customer') throw new Error('Refund eligibility can only be checked for a customer account.');
  if (!mongoose.isValidObjectId(args.orderId) || typeof args.reason !== 'string' || args.reason.length < 5 || args.reason.length > 3000) throw new Error('A valid orderId and a reason between 5 and 3000 characters are required.');
  const order = await Order.findOne({ _id: args.orderId, customerId: user._id });
  if (!order) return { eligible: false, recommendation: 'NOT_ELIGIBLE', reason: 'Order was not found for this account.' };
  const { evaluateRefund } = await import('./refundService.js');
  const evaluation = await evaluateRefund({ order, reason: args.reason, customer: user });
  return { eligible: evaluation.eligible, recommendation: evaluation.recommendation, explanation: evaluation.explanation, confidence: evaluation.confidence, policyReasons: evaluation.policyReasons, requiresSellerApproval: true };
}

const toolRegistry = Object.freeze({
  search_products: searchProducts,
  get_product_details: getProductDetails,
  compare_products: compareProducts,
  prepare_cart: prepareCart,
  get_order_status: getOrderStatus,
  check_refund_eligibility: checkRefundEligibility,
});

function executeTool(name, args, user) {
  const handler = toolRegistry[name];
  if (!handler) throw new Error('That tool is not available.');
  return handler(args, user);
}

async function groqChat(messages, useTools = true, jsonMode = false) {
  if (!groqConfig.apiKey) {
    const error = new Error('AI service is not configured. Set GROQ_API_KEY on the server.');
    error.statusCode = 503;
    throw error;
  }
  try {
    const response = await getGroqClient().chat.completions.create({
      model: groqConfig.model,
      messages,
      temperature: 0.2,
      ...(useTools ? { tools, tool_choice: 'auto' } : {}),
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
    return response.choices?.[0]?.message;
  } catch (cause) {
    const error = new Error(cause.code === 'ETIMEDOUT' || cause.code === 'ECONNABORTED' ? 'Groq timed out. Please try again.' : cause.status === 401 ? 'Groq rejected the configured API key.' : cause.error?.message || 'Groq is temporarily unavailable.');
    error.statusCode = 503;
    throw error;
  }
}

function withToolTimeout(operation, milliseconds = 8000) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The requested catalog tool timed out.')), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

export async function runShoppingAssistant({ user, conversationMessages }) {
  const system = {
    role: 'system',
    content: 'You are SellerShield’s commerce assistant. Use tools for every product price, inventory, order status, or refund policy fact. Never invent catalog items, prices, stock, orders, payment states, or promise a refund. You may recommend and compare only products returned by catalog tools. Catalog and checkout prices are USD; when the customer gives an INR budget, call search_products with currency=INR so the server converts using its configured INR_PER_USD_RATE (INR per USD); if conversion is unavailable, explain that and ask for USD. Call compare_products to verify both products before comparing. Call prepare_cart only after the customer clearly asks to add a specific item; otherwise ask which item or quantity they want. Prior recommendation metadata may identify products, but re-check current catalog data through tools. A refund recommendation is not approval. If a tool fails or data is unavailable, say so plainly; never imply an unsuccessful tool succeeded. Be concise, useful, and conversational.',
  };
  const messages = [system, ...conversationMessages.slice(-12).map(message => ({
    role: message.role,
    content: message.metadata ? `${message.content}\nVerified product references from this prior response: ${JSON.stringify(message.metadata).slice(0, 5000)}` : message.content,
  }))];
  const recommendations = [];
  let cartUpdated = false;
  let type = 'text';
  let comparison = null;
  let orderStatus = null;
  let refundAnalysis = null;
  for (let round = 0; round < 4; round += 1) {
    const answer = await groqChat(messages, true);
    if (!answer) throw new Error('AI service returned an empty response.');
    messages.push(answer);
    const calls = answer.tool_calls || [];
    if (!calls.length) {
      const unique = [...new Map(recommendations.map(product => [String(product.id), product])).values()];
      return { reply: answer.content || 'I could not complete that response. Please try again.', type, products: unique.slice(0, 4), comparison, orderStatus, refundAnalysis, cartUpdated };
    }
    if (!Array.isArray(calls) || calls.length > 5) {
      const error = new Error('Groq requested too many tools in one response. Please narrow the request.');
      error.statusCode = 502;
      throw error;
    }
    for (const call of calls) {
      let result;
      try {
        const name = call.function?.name;
        if (!tools.some(tool => tool.function.name === name)) throw new Error('Unknown tool requested.');
        result = await withToolTimeout(Promise.resolve().then(() => executeTool(name, jsonArgs(call.function.arguments), user)));
        if (name === 'search_products' && Array.isArray(result)) { recommendations.push(...result); type = result.length ? 'product_recommendations' : 'text'; }
        if (name === 'get_product_details' && result?.found) { recommendations.push(result); type = 'product_recommendations'; }
        if (name === 'compare_products' && result?.found) { comparison = result.products; type = 'product_comparison'; }
        if (name === 'prepare_cart' && result?.added) { cartUpdated = true; type = 'cart_prepared'; }
        if (name === 'get_order_status' && result?.found) { orderStatus = result; type = 'order_status'; }
        if (name === 'check_refund_eligibility') { refundAnalysis = result; type = 'refund_analysis'; }
      } catch (error) {
        result = { error: error.message };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 10000) });
    }
  }
  throw new Error('AI tool-use limit reached. Please narrow your request and try again.');
}

export async function generateRefundRecommendation(context) {
  const fallback = {
    recommendation: context.eligible ? 'MANUAL_REVIEW' : 'NOT_ELIGIBLE',
    explanation: context.policyReasons.join(' ') || 'Seller review is required before a refund decision.',
    confidence: 0.35,
    policyReasons: context.policyReasons,
    requiresSellerApproval: true,
    source: 'rules',
  };
  if (!groqConfig.apiKey) return fallback;
  try {
    const message = await groqChat([
      { role: 'system', content: 'Assess this refund complaint using only the supplied verified order, payment, delivery, and seller policy facts. Return JSON only with keys recommendation, explanation, confidence (0 to 1), and policyReasons (string array). recommendation must be one of FULL_REFUND, PARTIAL_REFUND, MANUAL_REVIEW, NOT_ELIGIBLE. Never invent an amount or facts. A recommendation is only advice: a seller must approve, and you cannot authorize or execute a refund.' },
      { role: 'user', content: JSON.stringify(context) },
    ], false, true);
    const parsed = JSON.parse(message?.content || '{}');
    const allowed = ['FULL_REFUND', 'PARTIAL_REFUND', 'MANUAL_REVIEW', 'NOT_ELIGIBLE'];
    if (!allowed.includes(parsed.recommendation) || typeof parsed.explanation !== 'string' || !Array.isArray(parsed.policyReasons)) throw new Error('Groq returned an invalid refund recommendation.');
    return {
      recommendation: !context.eligible ? 'NOT_ELIGIBLE' : parsed.recommendation,
      explanation: parsed.explanation.slice(0, 4000),
      confidence: Number.isFinite(Number(parsed.confidence)) ? Math.min(1, Math.max(0, Number(parsed.confidence))) : fallback.confidence,
      policyReasons: parsed.policyReasons.filter(item => typeof item === 'string').slice(0, 10),
      requiresSellerApproval: true,
      source: 'groq',
    };
  } catch {
    return { ...fallback, source: 'rules', explanation: context.policyReasons.join(' ') || 'AI analysis was unavailable; seller review is required.' };
  }
}

export async function generateBusinessAnalysis(statistics) {
  const allowedMetrics = new Set([
    'totalRevenue', 'weeklyRevenue', 'weeklyOrders', 'monthlyRevenue', 'monthlyOrders',
    'ordersInRange', 'topProductUnits', 'refundRequests', 'refundedAmount', 'lowStockProducts',
    'inventoryUnits', 'repeatCustomerRate', 'capturedPayments',
  ]);
  const errorResult = message => { const error = new Error(message); error.statusCode = 503; return error; };
  if (!groqConfig.apiKey) throw errorResult('AI business insights require GROQ_API_KEY.');
  try {
    const message = await groqChat([
      { role: 'system', content: 'You are a cautious commerce analyst. Analyze only the supplied MongoDB statistics. Return JSON only: {"summary":string,"insights":[{"title":string,"category":"performance|trend|product|inventory|refund|customer","description":string,"metricKey":string,"actionLabel":string}]}. Each metricKey must exactly match a numeric field in the supplied statistics. Ground each insight in that metric, do not invent numbers, causes, customer details, or product performance not shown, and use cautious language for small samples. Provide at most 5 useful insights. Do not put numeric claims in prose; the backend will attach the verified value.' },
      { role: 'user', content: JSON.stringify(statistics) },
    ], false, true);
    const parsed = JSON.parse(message?.content || '{}');
    if (typeof parsed.summary !== 'string' || /[0-9₹$]/.test(parsed.summary) || !Array.isArray(parsed.insights)) throw new Error('Groq returned malformed business analysis.');
    const insights = parsed.insights.slice(0, 5).filter(item => item && typeof item.title === 'string' && typeof item.description === 'string' && !/[0-9₹$]/.test(item.description) && allowedMetrics.has(item.metricKey) && Number.isFinite(Number(statistics[item.metricKey])))
      .map((item, index) => ({
        id: `ai-${index + 1}`,
        title: item.title.slice(0, 120),
        category: ['performance', 'trend', 'product', 'inventory', 'refund', 'customer'].includes(item.category) ? item.category : 'performance',
        description: item.description.slice(0, 700),
        metricKey: item.metricKey,
        metricValue: statistics[item.metricKey],
        actionLabel: typeof item.actionLabel === 'string' ? item.actionLabel.slice(0, 120) : '',
      }));
    if (!insights.length) throw new Error('Groq returned no verifiable business insights.');
    return { summary: parsed.summary.slice(0, 1200), insights };
  } catch (cause) {
    const error = new Error(cause.message === 'Groq returned malformed business analysis.' || cause.message === 'Groq returned no verifiable business insights.' ? cause.message : 'Groq could not produce verified business insights. Please retry.');
    error.statusCode = cause.statusCode || 502;
    throw error;
  }
}

export { tools as groqTools };
