import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paypalOrderId: { type: String, required: true, unique: true, index: true },
  captureId: { type: String, unique: true, sparse: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true },
  paymentMethod: { type: String, default: 'PayPal' },
  status: { type: String, enum: ['pending', 'success', 'failed', 'partially_refunded', 'refunded', 'reversed'], default: 'pending', index: true },
  rawCaptureStatus: String,
  refundedAmount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
