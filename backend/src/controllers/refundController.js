import { validationResult } from 'express-validator';
import RefundRequest from '../models/RefundRequest.js';
import { createRefundRequest, processSellerDecision } from '../services/refundService.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

function present(refund) {
  return {
    id: String(refund._id),
    orderId: refund.orderId?._id ? String(refund.orderId._id) : String(refund.orderId),
    customer: refund.customerId?.name ? { name: refund.customerId.name, email: refund.customerId.email } : undefined,
    customerName: refund.customerId?.name,
    complaint: refund.reason,
    reason: refund.reason,
    evidence: refund.evidence,
    amount: refund.requestedAmount,
    aiRecommendation: refund.aiRecommendation,
    aiExplanation: refund.aiExplanation,
    aiConfidence: refund.aiConfidence,
    recommendationSource: refund.recommendationSource || 'rules',
    requiresSellerApproval: refund.requiresSellerApproval !== false,
    policyReasons: refund.policyReasons,
    status: refund.approvalStatus,
    refundStatus: refund.refundStatus,
    createdAt: refund.createdAt,
    paypalRefundId: refund.paypalRefundId,
  };
}

export const createRequest = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const { refund } = await createRefundRequest({
    orderId: req.body.orderId,
    customer: req.user,
    reason: req.body.reason,
    evidence: Array.isArray(req.body.evidence) ? req.body.evidence.slice(0, 10) : [],
    requestedAmount: req.body.requestedAmount,
  });
  res.status(201).json(present(refund));
});

export const listRequests = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'seller' ? { sellerId: req.user._id } : { customerId: req.user._id };
  if (req.query.status) filter.approvalStatus = req.query.status;
  const refunds = await RefundRequest.find(filter).sort({ createdAt: -1 }).limit(200)
    .populate('customerId', 'name email').populate('orderId', 'totalAmount currency orderStatus paymentStatus').lean();
  res.json(refunds.map(present));
});

export const decideRequest = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const refund = await processSellerDecision({ refundId: req.params.id, seller: req.user, decision: req.body.decision });
  res.json(present(refund));
});
