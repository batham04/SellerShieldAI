import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');
  mongoose.set('strictQuery', true);
  const uriDatabaseName = decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, '')) || undefined;
  const dbName = process.env.MONGODB_DB_NAME || uriDatabaseName || 'sellershield';
  await mongoose.connect(uri, { dbName, autoIndex: process.env.NODE_ENV !== 'production' });
  console.info('MongoDB connected.');
}
