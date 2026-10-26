// A LoginEvent is a historical audit record (not an active session).
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, required: true },
  outcome: { type: String, enum: ['success', 'failed'], required: true },
  browser: String, device: String, ipAddress: String,
}, { timestamps: true });
// Keep 90 days of login events to limit collection of device/IP information.
schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
export default mongoose.model('LoginEvent', schema);
