// A User is a document stored in the MongoDB "users" collection.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // select:false prevents password hashes from being returned in normal queries.
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'staff'], required: true },
  active: { type: Boolean, default: true },
  // Each new Staff login increases this number and invalidates older sessions.
  // Owners may have multiple sessions and don't use this check.
  sessionVersion: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
