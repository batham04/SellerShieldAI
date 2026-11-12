import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role: { type: String, enum: ['seller', 'customer'], required: true, default: 'customer' },
  storeName: { type: String, trim: true, maxlength: 120, default: '' },
  website: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  returnWindow: { type: String, enum: ['14 days', '30 days', '60 days', 'Final sale'], default: '30 days' },
  acceptReturns: { type: Boolean, default: true },
  refundPolicy: { type: String, trim: true, maxlength: 3000, default: '' },
}, { timestamps: true, toJSON: { transform: (_doc, ret) => { delete ret.password; delete ret.__v; return ret; } } });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
