import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';

function badRequest(message) { const error = new Error(message); error.statusCode = 400; return error; }

export async function priceAndReserveItems(customerId, rawItems, shipping, currency = 'USD') {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) throw badRequest('Provide between 1 and 50 order items.');
  const quantities = new Map();
  for (const item of rawItems) {
    const id = String(item.productId || item.id || '');
    const quantity = Number(item.quantity);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw badRequest('Each item needs a valid product ID and quantity from 1 to 100.');
    const nextQuantity = (quantities.get(id) || 0) + quantity;
    if (nextQuantity > 100) throw badRequest('The total quantity for a product cannot exceed 100.');
    quantities.set(id, nextQuantity);
  }
  const ids = [...quantities.keys()];
  const products = await Product.find({ _id: { $in: ids }, isActive: true });
  if (products.length !== ids.length) throw badRequest('One or more products are unavailable. Please refresh your cart.');
  const sellerIds = new Set(products.map(product => String(product.sellerId)));
  if (sellerIds.size !== 1) throw badRequest('Items from different stores must be checked out separately.');

  const items = products.map(product => ({
    productId: product._id,
    sellerId: product.sellerId,
    name: product.name,
    unitPrice: product.price,
    quantity: quantities.get(String(product._id)),
    image: product.image,
  }));
  const totalAmount = Number(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2));
  const reserved = [];
  try {
    for (const item of items) {
      const result = await Product.updateOne(
        { _id: item.productId, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (!result.modifiedCount) throw badRequest(`Not enough stock for ${item.name}.`);
      reserved.push(item);
    }
    const order = await Order.create({
      customerId,
      items,
      totalAmount,
      currency,
      shipping: shipping || {},
      stockReserved: true,
    });
    return { order, sellerId: products[0].sellerId };
  } catch (error) {
    await Promise.all(reserved.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })));
    throw error;
  }
}

export async function releaseOrderReservation(order) {
  const updated = await Order.updateOne(
    { _id: order._id, stockReserved: true, paymentStatus: { $ne: 'paid' } },
    { $set: { stockReserved: false } }
  );
  if (!updated.modifiedCount) return;
  await Promise.all(order.items.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })));
}

export async function expireStalePaymentOrders(maxAgeMinutes = 120) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await Order.find({ paymentStatus: 'pending', stockReserved: true, createdAt: { $lt: cutoff } }).select('_id items');
  for (const order of stale) {
    const expired = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'pending', stockReserved: true },
      { $set: { paymentStatus: 'failed', stockReserved: false } },
      { new: true }
    );
    if (!expired) continue;
    await Promise.all(expired.items.map(item => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })));
    await Payment.updateOne({ orderId: expired._id, status: 'pending' }, { $set: { status: 'failed', rawCaptureStatus: 'EXPIRED' } });
  }
  return stale.length;
}

export async function recordCapture(order, capture) {
  const captureId = capture?.id;
  const amount = Number(capture?.amount?.value);
  const currency = String(capture?.amount?.currency_code || '').toUpperCase();
  if (!captureId || capture.status !== 'COMPLETED' || amount !== Number(order.totalAmount.toFixed(2)) || currency !== order.currency) {
    const error = new Error('PayPal capture could not be verified against the order amount and currency.');
    error.statusCode = 409;
    throw error;
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $in: ['pending', 'capturing'] }, paypalOrderId: order.paypalOrderId },
    { $set: { paymentStatus: 'paid', orderStatus: 'processing', captureId, capturedAt: new Date(), stockReserved: false } },
    { new: true }
  );
  if (!updated) {
    const current = await Order.findById(order._id);
    if (current?.paymentStatus === 'paid' && current.captureId === captureId) return current;
    const error = new Error('This order has already been processed or is no longer payable.');
    error.statusCode = 409;
    throw error;
  }
  await Payment.findOneAndUpdate(
    { paypalOrderId: order.paypalOrderId },
    { $set: { captureId, amount, currency, status: 'success', rawCaptureStatus: capture.status } },
    { new: true }
  );
  return updated;
}
