// A Session represents one browser login. The server checks this record on every protected request.
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenIdHash: { type: String, required: true, unique: true },
  browser: String, device: String, ipAddress: String,
  lastSeenAt: Date,
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });
// Expired sessions disappear eventually; invalidity is also checked immediately in code.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('Session', schema);
