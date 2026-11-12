import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 3000 },
  evidence: [{ type: String, trim: true, maxlength: 500 }],
  requestedAmount: { type: Number, required: true, min: 0 },
  aiRecommendation: { type: String, enum: ['FULL_REFUND', 'PARTIAL_REFUND', 'MANUAL_REVIEW', 'NOT_ELIGIBLE', 'Full refund recommended', 'Partial refund recommended', 'Manual review required', 'Refund not eligible under the configured policy'], default: 'MANUAL_REVIEW' },
  aiExplanation: { type: String, maxlength: 4000, default: '' },
  aiConfidence: { type: Number, min: 0, max: 1, default: 0 },
  recommendationSource: { type: String, enum: ['groq', 'rules'], default: 'rules' },
  requiresSellerApproval: { type: Boolean, default: true },
  policyReasons: [{ type: String, maxlength: 500 }],
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  paypalRefundId: { type: String, unique: true, sparse: true },
  refundStatus: { type: String, enum: ['not_processed', 'processing', 'completed', 'failed', 'pending'], default: 'not_processed', index: true },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
}, { timestamps: true });

export default mongoose.model('RefundRequest', refundRequestSchema);
