import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 12000 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, maxlength: 120, default: 'Shopping conversation' },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('Conversation', conversationSchema);
