import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Conversation from '../models/Conversation.js';
import Order from '../models/Order.js';
import { evaluateRefund } from '../services/refundService.js';
import { getBusinessInsights } from '../services/businessInsightsService.js';
import { runShoppingAssistant } from '../services/aiService.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

export const chat = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ message: 'A message is required.' });
  let conversation;
  if (req.body.conversationId) {
    if (!mongoose.isValidObjectId(req.body.conversationId)) return res.status(400).json({ message: 'Invalid conversation ID.' });
    conversation = await Conversation.findOne({ _id: req.body.conversationId, userId: req.user._id });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
  } else {
    conversation = await Conversation.create({ userId: req.user._id, title: message.slice(0, 100), messages: [] });
  }
  conversation.messages.push({ role: 'user', content: message });
  const history = conversation.messages.slice(-12).map(item => ({ role: item.role, content: item.content, metadata: item.metadata }));
  const answer = await runShoppingAssistant({ user: req.user, conversationMessages: history });
  const metadata = { type: answer.type, products: answer.products, comparison: answer.comparison, orderStatus: answer.orderStatus, refundAnalysis: answer.refundAnalysis, cartUpdated: answer.cartUpdated };
  conversation.messages.push({ role: 'assistant', content: answer.reply, metadata });
  if (conversation.messages.length > 100) conversation.messages.splice(0, conversation.messages.length - 100);
  await conversation.save();
  const data = { products: answer.products, comparison: answer.comparison, orderStatus: answer.orderStatus, refundAnalysis: answer.refundAnalysis, cartUpdated: answer.cartUpdated };
  res.json({ success: true, type: answer.type, message: answer.reply, conversationId: String(conversation._id), data, reply: answer.reply, ...data });
});

export const analyzeRefund = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const order = await Order.findOne({ _id: req.body.orderId, customerId: req.user._id });
  if (!order) return res.status(404).json({ message: 'Order not found for this account.' });
  const result = await evaluateRefund({ order, reason: req.body.reason, evidence: req.body.evidence || [], customer: req.user });
  res.json({
    success: true,
    type: 'refund_analysis',
    data: {
      eligible: result.eligible,
      recommendation: result.recommendation,
      confidence: result.confidence,
      explanation: result.explanation,
      policyReasons: result.policyReasons,
      requiresSellerApproval: true,
      source: result.source,
    },
  });
});

export const businessInsights = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const result = await getBusinessInsights(req.user._id, req.query.range || '30d');
  res.json(result);
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ userId: req.user._id })
    .sort({ updatedAt: -1 }).limit(30).select('title messages createdAt updatedAt').lean();
  res.json(conversations.map(conversation => ({
    id: String(conversation._id),
    title: conversation.title,
    messages: conversation.messages,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  })));
});
