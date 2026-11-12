import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import RefundRequest from '../models/RefundRequest.js';
import User from '../models/User.js';
import { refundPaypalCapture } from './paypalService.js';
import { generateRefundRecommendation } from './aiService.js';

const day = 24 * 60 * 60 * 1000;

export async function evaluateRefund({ order, reason, evidence = [], customer }) {
  const sellerId = order.items[0]?.sellerId;
  const seller = sellerId ? await User.findById(sellerId).select('returnWindow acceptReturns refundPolicy') : null;
  const payment = await Payment.findOne({ orderId: order._id });
  const policyReasons = [];
  let eligible = true;
  if (!payment || !['success', 'partially_refunded'].includes(payment.status) || !order.captureId) { eligible = false; policyReasons.push('Order has no verified successful capture.'); }
  if (order.orderStatus !== 'delivered') { eligible = false; policyReasons.push('Delivery is not marked complete yet; a seller must review the delivery issue.'); }
  if (!seller?.acceptReturns) { eligible = false; policyReasons.push('This store is not currently accepting returns.'); }
  if (seller?.returnWindow === 'Final sale') { eligible = false; policyReasons.push('The store policy marks purchases as final sale.'); }
  const days = Number.parseInt(seller?.returnWindow || '30', 10);
  if (Number.isFinite(days) && order.createdAt < new Date(Date.now() - days * day)) { eligible = false; policyReasons.push(`The store return window is ${days} days and has passed.`); }
  if (order.paymentStatus === 'refunded') { eligible = false; policyReasons.push('This order has already been fully refunded.'); }
  const remaining = payment ? Math.max(0, payment.amount - payment.refundedAmount) : 0;
  if (remaining <= 0) { eligible = false; policyReasons.push('No refundable captured amount remains.'); }
  const requestContext = {
    complaint: reason,
    evidence,
    order: { id: String(order._id), createdAt: order.createdAt, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, totalAmount: order.totalAmount, currency: order.currency, items: order.items.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice })) },
    transaction: payment ? { status: payment.status, capturedAmount: payment.amount, refundedAmount: payment.refundedAmount, currency: payment.currency } : null,
    policy: seller ? { acceptsReturns: seller.acceptReturns, returnWindow: seller.returnWindow, text: seller.refundPolicy } : null,
    policyReasons,
    eligible,
  };
  const recommendation = await generateRefundRecommendation(requestContext);
  return { eligible, remaining, payment, seller, policyReasons, ...recommendation };
}

export async function createRefundRequest({ orderId, customer, reason, evidence, requestedAmount: requestedInput }) {
  if (!mongoose.isValidObjectId(orderId)) { const error = new Error('A valid orderId is required.'); error.statusCode = 400; throw error; }
  const order = await Order.findOne({ _id: orderId, customerId: customer._id });
  if (!order) { const error = new Error('Order not found for this account.'); error.statusCode = 404; throw error; }
  const existing = await RefundRequest.findOne({ orderId: order._id, customerId: customer._id, approvalStatus: { $in: ['pending', 'approved'] }, refundStatus: { $ne: 'failed' } });
  if (existing) { const error = new Error('A refund request is already open for this order.'); error.statusCode = 409; throw error; }
  const evaluation = await evaluateRefund({ order, reason, evidence, customer });
  if (!evaluation.payment) { const error = new Error('The order has no captured payment to review.'); error.statusCode = 409; throw error; }
  const requestedAmount = requestedInput === undefined ? evaluation.remaining : Number(requestedInput);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > evaluation.remaining) {
    const error = new Error('Requested refund amount must be positive and cannot exceed the remaining captured amount.');
    error.statusCode = 400;
    throw error;
  }
  const refund = await RefundRequest.create({
    orderId: order._id,
    paymentId: evaluation.payment._id,
    customerId: customer._id,
    sellerId: evaluation.seller?._id || order.items[0].sellerId,
    reason,
    evidence,
    requestedAmount,
    aiRecommendation: evaluation.recommendation,
    aiExplanation: evaluation.explanation,
    aiConfidence: evaluation.confidence,
    recommendationSource: evaluation.source,
    requiresSellerApproval: true,
    policyReasons: evaluation.policyReasons,
  });
  return { refund, eligible: evaluation.eligible };
}

export async function processSellerDecision({ refundId, seller, decision }) {
  const refund = await RefundRequest.findOne({ _id: refundId, sellerId: seller._id });
  if (!refund) { const error = new Error('Refund request not found in your store.'); error.statusCode = 404; throw error; }
  const retryingFailedRefund = refund.approvalStatus === 'approved' && refund.refundStatus === 'failed' && decision === 'approved';
  if ((!retryingFailedRefund && refund.approvalStatus !== 'pending') || (!retryingFailedRefund && refund.refundStatus !== 'not_processed')) { const error = new Error('This refund request has already been reviewed or is being processed.'); error.statusCode = 409; throw error; }
  if (decision === 'rejected') {
    refund.approvalStatus = 'rejected';
    refund.processedBy = seller._id;
    refund.processedAt = new Date();
    await refund.save();
    return refund;
  }
  const locked = await RefundRequest.findOneAndUpdate(
    { _id: refund._id, approvalStatus: retryingFailedRefund ? 'approved' : 'pending', refundStatus: retryingFailedRefund ? 'failed' : 'not_processed' },
    { $set: { approvalStatus: 'approved', refundStatus: 'processing', processedBy: seller._id, processedAt: new Date() } },
    { new: true }
  );
  if (!locked) { const error = new Error('This refund request is already being processed.'); error.statusCode = 409; throw error; }
  const [order, payment] = await Promise.all([Order.findById(refund.orderId), Payment.findById(refund.paymentId)]);
  if (!order?.captureId || !payment || !['success', 'partially_refunded'].includes(payment.status)) {
    await RefundRequest.updateOne({ _id: refund._id }, { $set: { refundStatus: 'failed' } });
    const error = new Error('The original capture could not be verified.'); error.statusCode = 409; throw error;
  }
  const eligibility = await evaluateRefund({ order, reason: refund.reason, evidence: refund.evidence, customer: { _id: refund.customerId } });
  if (!eligibility.eligible) {
    await RefundRequest.updateOne({ _id: refund._id }, { $set: { refundStatus: 'failed' } });
    const error = new Error(`Refund cannot be processed under the current verified order and store policy: ${eligibility.policyReasons.join(' ')}`);
    error.statusCode = 409;
    throw error;
  }
  const reservedRefunds = await RefundRequest.aggregate([
    { $match: { paymentId: payment._id, _id: { $ne: refund._id }, refundStatus: { $in: ['pending', 'processing'] } } },
    { $group: { _id: null, amount: { $sum: '$requestedAmount' } } },
  ]);
  const remaining = Number((payment.amount - payment.refundedAmount - (reservedRefunds[0]?.amount || 0)).toFixed(2));
  if (refund.requestedAmount <= 0 || refund.requestedAmount > remaining) {
    await RefundRequest.updateOne({ _id: refund._id }, { $set: { refundStatus: 'failed' } });
    const error = new Error('The requested refund exceeds the remaining captured amount.'); error.statusCode = 409; throw error;
  }
  try {
    const response = await refundPaypalCapture(order.captureId, refund.requestedAmount, order.currency, `refund-${refund._id}`);
    refund.paypalRefundId = response.id;
    refund.refundStatus = response.status === 'COMPLETED' ? 'completed' : response.status === 'PENDING' ? 'pending' : 'failed';
    await refund.save();
    if (response.status === 'COMPLETED') {
      payment.refundedAmount = Number((payment.refundedAmount + refund.requestedAmount).toFixed(2));
      payment.status = payment.refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';
      await payment.save();
      if (payment.status === 'refunded') await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'refunded' } });
      else await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'partially_refunded' } });
    } else if (response.status === 'PENDING') {
      // The webhook finalizes the payment totals when PayPal confirms the refund.
    }
    return refund;
  } catch (error) {
    await RefundRequest.updateOne({ _id: refund._id }, { $set: { refundStatus: 'failed' } });
    throw error;
  }
}
