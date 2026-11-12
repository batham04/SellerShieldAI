import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Product from '../models/Product.js';
import RefundRequest from '../models/RefundRequest.js';
import { generateBusinessAnalysis } from './aiService.js';

const DAY = 24 * 60 * 60 * 1000;
const paidStatuses = ['success', 'partially_refunded', 'refunded'];

export async function getBusinessInsights(sellerId, requestedRange = '30d') {
  const seller = new mongoose.Types.ObjectId(sellerId);
  const days = [7, 30, 90].includes(Number(String(requestedRange).replace(/d$/i, ''))) ? Number(String(requestedRange).replace(/d$/i, '')) : 30;
  const since = new Date(Date.now() - days * DAY);
  const [totals, weekly, monthly, topProducts, refundTrends, inventory, customerStats, ordersInRange] = await Promise.all([
    Payment.aggregate([
      { $match: { sellerId: seller, status: { $in: paidStatuses } } },
      { $group: { _id: null, capturedRevenue: { $sum: '$amount' }, refundedAmount: { $sum: '$refundedAmount' }, capturedPayments: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { sellerId: seller, status: { $in: paidStatuses }, createdAt: { $gte: new Date(Date.now() - 7 * DAY) } } },
      { $group: { _id: null, revenue: { $sum: { $subtract: ['$amount', '$refundedAmount'] } }, orders: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { sellerId: seller, status: { $in: paidStatuses }, createdAt: { $gte: new Date(Date.now() - 30 * DAY) } } },
      { $group: { _id: null, revenue: { $sum: { $subtract: ['$amount', '$refundedAmount'] } }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { 'items.sellerId': seller, paymentStatus: { $in: ['paid', 'partially_refunded'] }, createdAt: { $gte: since } } },
      { $unwind: '$items' }, { $match: { 'items.sellerId': seller } },
      { $group: { _id: '$items.productId', name: { $first: '$items.name' }, unitsSold: { $sum: '$items.quantity' } } },
      { $sort: { unitsSold: -1 } }, { $limit: 5 },
    ]),
    RefundRequest.aggregate([
      { $match: { sellerId: seller, createdAt: { $gte: since } } },
      { $group: { _id: { approval: '$approvalStatus', processing: '$refundStatus' }, count: { $sum: 1 }, requestedAmount: { $sum: '$requestedAmount' } } },
    ]),
    Product.aggregate([
      { $match: { sellerId: seller, isActive: true } },
      { $group: { _id: null, activeProducts: { $sum: 1 }, inventoryUnits: { $sum: '$stock' }, lowStockProducts: { $sum: { $cond: [{ $lte: ['$stock', 5] }, 1, 0] } } } },
    ]),
    Order.aggregate([
      { $match: { 'items.sellerId': seller, paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } } },
      { $group: { _id: '$customerId', orders: { $sum: 1 } } },
      { $group: { _id: null, customers: { $sum: 1 }, repeatCustomers: { $sum: { $cond: [{ $gt: ['$orders', 1] }, 1, 0] } } } },
    ]),
    Payment.countDocuments({ sellerId: seller, status: { $in: paidStatuses }, createdAt: { $gte: since } }),
  ]);

  const total = totals[0] || { capturedRevenue: 0, refundedAmount: 0, capturedPayments: 0 };
  const week = weekly[0] || { revenue: 0, orders: 0 };
  const month = monthly[0] || { revenue: 0, orders: 0 };
  const stock = inventory[0] || { activeProducts: 0, inventoryUnits: 0, lowStockProducts: 0 };
  const customers = customerStats[0] || { customers: 0, repeatCustomers: 0 };
  const refundRequestCount = refundTrends.reduce((sum, row) => sum + row.count, 0);
  const refundPaid = Number(total.refundedAmount.toFixed(2));
  const statistics = {
    currency: 'USD', rangeDays: days,
    totalRevenue: Number(Math.max(0, total.capturedRevenue - refundPaid).toFixed(2)),
    capturedPayments: total.capturedPayments,
    weeklyRevenue: Number(week.revenue.toFixed(2)), weeklyOrders: week.orders,
    monthlyRevenue: Number(month.revenue.toFixed(2)), monthlyOrders: month.orders,
    ordersInRange,
    topProducts: topProducts.map(row => ({ name: row.name, unitsSold: row.unitsSold })),
    topProductUnits: topProducts.reduce((sum, row) => sum + row.unitsSold, 0),
    refundRequests: refundRequestCount, refundedAmount: refundPaid,
    refundTrends: refundTrends.map(row => ({ approvalStatus: row._id.approval, refundStatus: row._id.processing, count: row.count, requestedAmount: Number(row.requestedAmount.toFixed(2)) })),
    activeProducts: stock.activeProducts, inventoryUnits: stock.inventoryUnits, lowStockProducts: stock.lowStockProducts,
    customers: customers.customers, repeatCustomers: customers.repeatCustomers,
    repeatCustomerRate: customers.customers ? Number((customers.repeatCustomers / customers.customers).toFixed(3)) : 0,
  };

  if (!statistics.capturedPayments) {
    return { success: true, status: 'insufficient_data', summary: 'There are no verified captured payments to analyze yet. Insights will appear after completed sales are recorded.', statistics, insights: [], source: 'mongodb' };
  }
  const analysis = await generateBusinessAnalysis(statistics);
  return { success: true, status: 'ready', ...analysis, statistics, source: 'mongodb+groq' };
}
