import { validationResult } from 'express-validator';
import { paypalConfig } from '../config/paypal.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import RefundRequest from '../models/RefundRequest.js';
import { createPaypalOrder, capturePaypalOrder, verifyPaypalWebhook } from '../services/paypalService.js';
import { priceAndReserveItems, recordCapture, releaseOrderReservation } from '../services/orderService.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

export const createPaymentOrder = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const { order, sellerId } = await priceAndReserveItems(req.user._id, req.body.items, req.body.shipping, paypalConfig.currency);
  try {
    const paypalOrder = await createPaypalOrder(order, String(order._id));
    order.paypalOrderId = paypalOrder.id;
    await order.save();
    await Payment.create({
      orderId: order._id,
      customerId: req.user._id,
      sellerId,
      paypalOrderId: paypalOrder.id,
      amount: order.totalAmount,
      currency: order.currency,
      status: 'pending',
    });
    const approvalUrl = paypalOrder.links?.find(link => link.rel === 'approve')?.href || null;
    return res.status(201).json({ id: paypalOrder.id, paypalOrderId: paypalOrder.id, orderId: String(order._id), approvalUrl, status: paypalOrder.status });
  } catch (error) {
    order.paymentStatus = 'failed';
    await order.save().catch(() => {});
    await releaseOrderReservation(order).catch(() => {});
    throw error;
  }
});

export const capturePaymentOrder = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const paypalOrderId = req.body.paypalOrderId || req.body.orderID || req.params.orderId;
  const order = await Order.findOne({ paypalOrderId, customerId: req.user._id });
  if (!order) return res.status(404).json({ message: 'PayPal order was not found for this account.' });
  if (order.paymentStatus === 'paid') return res.json({ success: true, status: 'COMPLETED', orderId: String(order._id), captureId: order.captureId });
  if (!['pending', 'capturing'].includes(order.paymentStatus)) return res.status(409).json({ message: 'This order is no longer payable.', status: order.paymentStatus });

  if (order.paymentStatus === 'pending') {
    const locked = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'pending' },
      { $set: { paymentStatus: 'capturing' } },
      { new: true }
    );
    if (!locked) {
      const current = await Order.findById(order._id);
      if (current?.paymentStatus === 'paid') return res.json({ success: true, status: 'COMPLETED', orderId: String(current._id), captureId: current.captureId });
      if (current?.paymentStatus !== 'capturing') return res.status(409).json({ message: 'This order is no longer payable.', status: current?.paymentStatus });
    }
  }

  let result;
  try {
    result = await capturePaypalOrder(paypalOrderId, `capture-${paypalOrderId}`);
  } catch (error) {
    const status = error.response?.data?.details?.[0]?.issue;
    if (status === 'ORDER_ALREADY_CAPTURED') {
      return res.status(409).json({ message: 'PayPal reports this order was already captured. Refresh order status before retrying.' });
    }
    throw error;
  }

  const unit = result.purchase_units?.find(item => item.reference_id === String(order._id)) || result.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (result.status === 'PENDING' || capture?.status === 'PENDING') {
    await Payment.updateOne({ paypalOrderId }, { $set: { status: 'pending', rawCaptureStatus: capture?.status || result.status } });
    return res.status(202).json({ success: false, status: 'PENDING', message: 'PayPal has not confirmed this payment yet.' });
  }
  if (result.status !== 'COMPLETED' || !capture) {
    await Order.updateOne({ _id: order._id, paymentStatus: { $in: ['pending', 'capturing'] } }, { $set: { paymentStatus: 'failed' } });
    await Payment.updateOne({ paypalOrderId }, { $set: { status: 'failed', rawCaptureStatus: capture?.status || result.status } });
    await releaseOrderReservation(order);
    return res.status(402).json({ success: false, status: capture?.status || result.status || 'FAILED', message: 'PayPal did not complete this payment.' });
  }
  const paidOrder = await recordCapture(order, capture);
  return res.json({ success: true, status: 'COMPLETED', orderId: String(paidOrder._id), captureId: paidOrder.captureId });
});

export const cancelPaymentOrder = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const paypalOrderId = req.body.paypalOrderId;
  const order = await Order.findOne({ paypalOrderId, customerId: req.user._id });
  if (!order) return res.status(404).json({ message: 'PayPal order was not found for this account.' });
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'capturing') return res.status(409).json({ message: 'A paid or currently capturing order cannot be cancelled.' });
  if (order.paymentStatus === 'pending') {
    order.paymentStatus = 'failed';
    await order.save();
    await releaseOrderReservation(order);
    await Payment.updateOne({ paypalOrderId, status: 'pending' }, { $set: { status: 'failed', rawCaptureStatus: 'CANCELLED' } });
  }
  res.json({ success: true, status: order.paymentStatus });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'seller' ? { sellerId: req.user._id } : { customerId: req.user._id };
  const transactions = await Payment.find(filter).sort({ createdAt: -1 }).limit(500).populate('customerId', 'name email').populate('orderId', 'items orderStatus').lean();
  res.json(transactions.map(payment => ({
    ...payment,
    id: String(payment._id),
    transactionId: payment.captureId || payment.paypalOrderId,
    customer: req.user.role === 'seller' ? payment.customerId : undefined,
    customerName: req.user.role === 'seller' ? payment.customerId?.name : undefined,
    order: payment.orderId,
    orderId: payment.orderId?._id ? String(payment.orderId._id) : '',
    paymentMethod: payment.paymentMethod,
    status: payment.status,
  })));
});

export const receivePaypalWebhook = asyncHandler(async (req, res) => {
  const verification = await verifyPaypalWebhook(req.headers, req.body);
  if (verification.verification_status !== 'SUCCESS') return res.status(400).json({ message: 'PayPal webhook signature is invalid.' });
  const event = req.body;
  const resource = event.resource || {};
  const relatedOrderId = resource.supplementary_data?.related_ids?.order_id || resource.id;
  const payment = relatedOrderId ? await Payment.findOne({ paypalOrderId: relatedOrderId }) : null;
  if (payment) {
    const order = await Order.findById(payment.orderId);
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && order && order.paymentStatus !== 'paid') {
      const capture = { id: resource.id, status: resource.status, amount: resource.amount };
      try {
        await recordCapture(order, capture);
      } catch (error) {
        console.error('Webhook capture did not match the stored order:', { eventId: event.id, paypalOrderId: relatedOrderId, reason: error.message });
      }
    } else if (['PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'].includes(event.event_type) && ['pending', 'capturing'].includes(order?.paymentStatus)) {
      await Order.updateOne({ _id: order._id, paymentStatus: { $in: ['pending', 'capturing'] } }, { $set: { paymentStatus: 'failed' } });
      await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { status: 'failed', rawCaptureStatus: resource.status } });
      await releaseOrderReservation(order);
    } else if (event.event_type === 'PAYMENT.CAPTURE.PENDING') {
      await Payment.updateOne({ _id: payment._id, status: 'pending' }, { $set: { rawCaptureStatus: resource.status } });
    } else if (event.event_type === 'PAYMENT.CAPTURE.REVERSED' && order?.paymentStatus === 'paid') {
      await Payment.updateOne({ _id: payment._id, status: 'success' }, { $set: { status: 'reversed', rawCaptureStatus: resource.status || 'REVERSED' } });
      await Order.updateOne({ _id: order._id, paymentStatus: 'paid' }, { $set: { paymentStatus: 'reversed' } });
    }
  }
  if (['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.REFUND.COMPLETED'].includes(event.event_type)) {
    const relatedCaptureId = resource.supplementary_data?.related_ids?.capture_id || resource.id;
    const refund = await RefundRequest.findOne({ paypalRefundId: resource.id, refundStatus: 'pending' });
    const fallbackPayment = refund ? null : await Payment.findOne({ captureId: relatedCaptureId });
    const pendingRefund = refund || (fallbackPayment ? await RefundRequest.findOne({ paymentId: fallbackPayment._id, refundStatus: 'pending' }).sort({ createdAt: 1 }) : null);
    if (pendingRefund) {
      pendingRefund.refundStatus = 'completed';
      await pendingRefund.save();
      const paymentRecord = await Payment.findById(pendingRefund.paymentId);
      const orderRecord = await Order.findById(pendingRefund.orderId);
      if (paymentRecord && orderRecord) {
        paymentRecord.refundedAmount = Number((paymentRecord.refundedAmount + pendingRefund.requestedAmount).toFixed(2));
        paymentRecord.status = paymentRecord.refundedAmount >= paymentRecord.amount ? 'refunded' : 'partially_refunded';
        await paymentRecord.save();
        orderRecord.paymentStatus = paymentRecord.status === 'refunded' ? 'refunded' : 'partially_refunded';
        await orderRecord.save();
      }
    }
  }
  if (event.event_type === 'PAYMENT.REFUND.FAILED') {
    await RefundRequest.updateOne({ paypalRefundId: resource.id, refundStatus: 'pending' }, { $set: { refundStatus: 'failed' } });
  }
  return res.status(200).json({ received: true });
});
