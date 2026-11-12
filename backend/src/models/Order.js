import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 100 },
  image: { type: String, default: '' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], required: true, validate: v => v.length > 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, default: 'USD' },
  orderStatus: { type: String, enum: ['awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'awaiting_payment', index: true },
  paymentStatus: { type: String, enum: ['pending', 'capturing', 'paid', 'failed', 'partially_refunded', 'refunded', 'reversed'], default: 'pending', index: true },
  paypalOrderId: { type: String, sparse: true, unique: true },
  captureId: { type: String, sparse: true, unique: true },
  shipping: { email: String, firstName: String, lastName: String, address: String, city: String, postalCode: String, country: String },
  stockReserved: { type: Boolean, default: false },
  capturedAt: Date,
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
