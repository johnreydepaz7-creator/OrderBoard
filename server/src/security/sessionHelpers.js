// Shared helpers for session identifiers, device labels, and cookie settings.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';

export const cookieOptions = {
  httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  path: '/', maxAge: 8 * 60 * 60 * 1000,
};
export function tokenHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
export function clientInfo(request) {
  const agent = request.get('user-agent') || '';
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox'
    : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Other browser';
  const device = /iPad/i.test(agent) ? 'iPad' : /iPhone/i.test(agent) ? 'iPhone'
    : /Android/i.test(agent) ? 'Android' : /Macintosh/i.test(agent) ? 'Mac'
    : /Windows/i.test(agent) ? 'Windows PC' : 'Unknown device';
  // request.ip is provided by Express. Don't blindly trust arbitrary forwarded headers.
  return { browser, device, ipAddress: request.ip || 'unknown' };
}
export async function issueSession(response, user, request) {
  const jti = crypto.randomUUID();
  const now = Date.now();
  const session = await Session.create({
    userId: user._id, tokenIdHash: tokenHash(jti), ...clientInfo(request),
    lastSeenAt: new Date(now), expiresAt: new Date(now + cookieOptions.maxAge),
  });
  const token = jwt.sign({ sub: String(user._id), jti,
    ...(user.role === 'staff' ? { sv: user.sessionVersion } : {}) }, process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '8h' });
  response.cookie('ob_session', token, cookieOptions);
  return session;
}
export function clearSessionCookie(response) {
  response.clearCookie('ob_session', {
    path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
}
export function safeSession(session, currentTokenHash) {
  return { id: String(session._id), browser: session.browser, device: session.device,
    ipAddress: session.ipAddress, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt, current: session.tokenIdHash === currentTokenHash };
}
