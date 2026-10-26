// Protect endpoints by verifying BOTH the signed cookie and a live MongoDB session.
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { tokenHash } from '../security/sessionHelpers.js';

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies.ob_session;
    if (!token) return response.status(401).json({ message: 'Please sign in.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload.jti !== 'string') {
      return response.status(401).json({ message: 'Please sign in again after the security update.' });
    }
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.active) return response.status(401).json({ message: 'Session is no longer valid.' });
    if (user.role === 'staff' && payload.sv !== (user.sessionVersion ?? 0)) {
      return response.status(401).json({ message: 'This staff account was signed in elsewhere. Please sign in again.' });
    }
    const hashed = tokenHash(payload.jti);
    const session = await Session.findOne({ userId: user._id, tokenIdHash: hashed,
      revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session) return response.status(401).json({ message: 'This login session was ended. Please sign in again.' });
    // Avoid updating the database on every page action.
    if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await Session.updateOne({ _id: session._id, revokedAt: null }, { lastSeenAt: new Date() });
    }
    request.sessionRecord = session;
    request.sessionTokenHash = hashed;
    request.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'CastError') {
      return response.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    next(error);
  }
}
export function ownerOnly(request, response, next) {
  if (request.user.role !== 'owner') return response.status(403).json({ message: 'Owner access required.' });
  next();
}
