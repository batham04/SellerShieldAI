import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  price: { type: Number, required: true, min: 0, validate: value => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7 },
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  image: { type: String, trim: true, default: '' },
  stock: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', category: 'text' });
export default mongoose.model('Product', productSchema);
