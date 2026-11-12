import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import refundRoutes from './routes/refundRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('This origin is not allowed by CORS.'));
}, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many authentication attempts. Try again later.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'AI request limit reached. Try again shortly.' } });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sellershield-api', timestamp: new Date().toISOString() }));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api', paymentRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/analytics', dashboardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api', webhookRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
