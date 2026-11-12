import './config/env.js';
import app from './app.js';
import { connectDatabase } from './config/db.js';
import { expireStalePaymentOrders } from './services/orderService.js';

const port = Number(process.env.PORT || 5000);

try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 characters.');
  }
  await connectDatabase();
  const server = app.listen(port, () => console.info(`SellerShield API listening on port ${port}.`));
  const reservationCleanup = setInterval(() => {
    expireStalePaymentOrders().catch(error => console.error('Pending-order cleanup failed:', error.message));
  }, 5 * 60 * 1000);
  reservationCleanup.unref();
  const shutdown = signal => {
    console.info(`${signal} received. Closing HTTP server.`);
    clearInterval(reservationCleanup);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error('Server startup failed:', error.message);
  process.exit(1);
}
