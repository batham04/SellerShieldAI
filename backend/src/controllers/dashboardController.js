import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import RefundRequest from '../models/RefundRequest.js';
import { asyncHandler } from '../utils/apiResponse.js';

export const analytics = asyncHandler(async (req, res) => {
  const sellerId = new mongoose.Types.ObjectId(req.user._id);
  const requestedDays = Number(String(req.query.range || '7d').replace(/d$/i, ''));
  const rangeDays = [7, 30, 90].includes(requestedDays) ? requestedDays : 7;
  const sellerOrders = { 'items.sellerId': sellerId };
  const [paymentTotals, totalOrders, successfulCount, pendingCount, refundCount, refundedTotal, topProducts, daily, recent] = await Promise.all([
    Payment.aggregate([{ $match: { sellerId, status: { $in: ['success', 'partially_refunded', 'refunded'] } } }, { $group: { _id: null, captured: { $sum: '$amount' }, refunded: { $sum: '$refundedAmount' } } }]),
    Order.countDocuments({ ...sellerOrders, paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } }),
    Payment.countDocuments({ sellerId, status: { $in: ['success', 'partially_refunded', 'refunded'] } }),
    Payment.countDocuments({ sellerId, status: 'pending' }),
    RefundRequest.countDocuments({ sellerId, approvalStatus: 'pending' }),
    Payment.aggregate([{ $match: { sellerId } }, { $group: { _id: null, total: { $sum: '$refundedAmount' } } }]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', ...sellerOrders } },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': sellerId } },
      { $group: { _id: '$items.productId', name: { $first: '$items.name' }, image: { $first: '$items.image' }, sold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } } } },
      { $sort: { sold: -1 } }, { $limit: 5 },
    ]),
    Payment.aggregate([
      { $match: { sellerId, status: { $in: ['success', 'partially_refunded', 'refunded'] }, createdAt: { $gte: new Date(Date.now() - rangeDays * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.find({ sellerId }).sort({ createdAt: -1 }).limit(8).populate('customerId', 'name email').lean(),
  ]);
  const totalRevenue = Number(Math.max(0, (paymentTotals[0]?.captured || 0) - (paymentTotals[0]?.refunded || 0)).toFixed(2));
  const recentTransactions = recent.map(payment => ({
    id: String(payment._id), transactionId: payment.captureId || payment.paypalOrderId,
    customer: payment.customerId ? { name: payment.customerId.name, email: payment.customerId.email } : null,
    customerName: payment.customerId?.name || 'Customer', amount: payment.amount,
    status: payment.status, paymentStatus: payment.status, createdAt: payment.createdAt,
  }));
  res.json({
    metrics: {
      totalRevenue,
      totalOrders,
      successfulPayments: successfulCount,
      pendingPayments: pendingCount,
      refundRequests: refundCount,
      refundedAmount: Number((refundedTotal[0]?.total || 0).toFixed(2)),
    },
    revenueSeries: daily.map(row => ({ day: row._id, revenue: Number(row.revenue.toFixed(2)) })),
    topProducts: topProducts.map(product => ({ id: String(product._id), name: product.name, image: product.image, sold: product.sold, revenue: Number(product.revenue.toFixed(2)) })),
    recentTransactions,
    insights: [],
  });
});
