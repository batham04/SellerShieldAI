import 'dotenv/config';
import { connectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

const products = [
  { name: 'Sunday Ceramic Pour-Over', category: 'Home & Living', description: 'A slow morning ritual shaped by hand in speckled stoneware.', price: 38, stock: 12, image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=85' },
  { name: 'The Everyday Canvas Tote', category: 'Accessories', description: 'A heavyweight recycled-cotton tote made for everyday errands.', price: 29, stock: 24, image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85' },
  { name: 'Cedar & Moss Candle', category: 'Home & Living', description: 'A forest morning in a hand-poured soy wax candle.', price: 24, stock: 8, image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85' },
  { name: 'Sunday Market Coffee', category: 'Pantry', description: 'Small-batch coffee with chocolate and toasted hazelnut notes.', price: 22, stock: 18, image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=85' },
  { name: 'Soft Landing Throw', category: 'Home & Living', description: 'Brushed cotton woven for a little extra warmth.', price: 68, stock: 4, image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85' },
  { name: 'Good Things Journal', category: 'Stationery', description: 'An undated daily journal for the ideas you want to keep.', price: 18, stock: 31, image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=85' },
];

try {
  await connectDatabase();
  const email = process.env.SELLER_SEED_EMAIL?.toLowerCase();
  const password = process.env.SELLER_SEED_PASSWORD;
  if (!email || !password || password.length < 8) throw new Error('Set SELLER_SEED_EMAIL and SELLER_SEED_PASSWORD (at least 8 characters) before seeding.');
  let seller = await User.findOne({ email });
  if (!seller) seller = await User.create({ name: 'Northstar Seller', email, password, role: 'seller', storeName: 'Northstar Goods' });
  if (seller.role !== 'seller') throw new Error('SELLER_SEED_EMAIL belongs to a non-seller account.');
  for (const product of products) {
    await Product.updateOne({ sellerId: seller._id, name: product.name }, { $setOnInsert: { ...product, sellerId: seller._id } }, { upsert: true });
  }
  console.info(`Seeded ${products.length} products for ${seller.email}.`);
  process.exit(0);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}
