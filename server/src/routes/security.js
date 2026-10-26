// Security center: own login history, active sessions, and session revocation.
import { Router } from 'express';
import { z } from 'zod';
import Session from '../models/Session.js';
import LoginEvent from '../models/LoginEvent.js';
import User from '../models/User.js';
import { requireAuth, ownerOnly } from '../middleware/auth.js';
import { safeSession, clearSessionCookie } from '../security/sessionHelpers.js';
const router = Router();
router.use(requireAuth);
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
function safeEvent(event) {
  return { id: String(event._id), outcome: event.outcome, device: event.device,
    browser: event.browser, ipAddress: event.ipAddress, createdAt: event.createdAt };
}
router.get('/history', async (request, response, next) => {
  try {
    const events = await LoginEvent.find({ userId: request.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    response.json({ history: events.map(safeEvent) });
  } catch (error) { next(error); }
});
router.get('/sessions', async (request, response, next) => {
  try {
    const sessions = await Session.find({ userId: request.user.id, revokedAt: null,
      expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(30).lean();
    response.json({ sessions: sessions.map(s => safeSession(s, request.sessionTokenHash)) });
  } catch (error) { next(error); }
});
router.post('/sessions/revoke-others', async (request, response, next) => {
  try {
    await Session.updateMany({ userId: request.user.id,
      _id: { $ne: request.sessionRecord._id }, revokedAt: null }, { revokedAt: new Date() });
    response.json({ message: 'Other sessions have been signed out.' });
  } catch (error) { next(error); }
});
router.post('/sessions/:id/revoke', async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) return response.status(400).json({ message: 'Invalid session ID.' });
    const result = await Session.updateOne({ _id: request.params.id, userId: request.user.id,
      revokedAt: null }, { revokedAt: new Date() });
    if (!result.matchedCount) return response.status(404).json({ message: 'Session not found.' });
    const isCurrent = String(request.sessionRecord._id) === request.params.id;
    if (isCurrent) clearSessionCookie(response);
    response.json({ message: 'Session signed out.', currentSessionRevoked: isCurrent });
  } catch (error) { next(error); }
});
// The owner can inspect staff activity and revoke a staff member's sessions.
router.get('/staff/:id/history', ownerOnly, async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) return response.status(400).json({ message: 'Invalid staff ID.' });
    const staff = await User.findOne({ _id: request.params.id, role: 'staff' });
    if (!staff) return response.status(404).json({ message: 'Staff member not found.' });
    const history = await LoginEvent.find({ userId: staff._id }).sort({ createdAt: -1 }).limit(50).lean();
    response.json({ staff: { id: String(staff._id), name: staff.name }, history: history.map(safeEvent) });
  } catch (error) { next(error); }
});
router.post('/staff/:id/revoke', ownerOnly, async (request, response, next) => {
  try {
    if (!objectId.safeParse(request.params.id).success) return response.status(400).json({ message: 'Invalid staff ID.' });
    const staff = await User.findOneAndUpdate({ _id: request.params.id, role: 'staff' },
      { $inc: { sessionVersion: 1 } }, { new: true });
    if (!staff) return response.status(404).json({ message: 'Staff member not found.' });
    await Session.updateMany({ userId: staff._id, revokedAt: null }, { revokedAt: new Date() });
    response.json({ message: 'Staff sessions revoked.' });
  } catch (error) { next(error); }
});
export default router;
