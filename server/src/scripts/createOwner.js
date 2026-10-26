// Run once to create the first Owner account.
// Example: npm.cmd run create-owner -- "Owner Name" "owner@example.com" "strong-password"
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const [name, email, password] = process.argv.slice(2);
// Require a name, valid-looking email, and a password of at least 12 characters.
if (!name || !email || !password || password.length < 12 || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: npm run create-owner -- "Full Name" owner@example.com "a-password-of-12-or-more-chars"');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  // Never create another Owner if the database already has one.
  const existingOwner = await User.findOne({ role: 'owner' });
  if (existingOwner) throw new Error('Owner already exists. Refusing to create another.');

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email: email.toLowerCase(), passwordHash, role: 'owner' });
  console.log('Owner account created.');
} finally {
  await mongoose.disconnect();
}
