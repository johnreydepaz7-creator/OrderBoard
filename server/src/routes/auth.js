// Login, logout and account profile endpoints.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import Session from '../models/Session.js';
import LoginEvent from '../models/LoginEvent.js';
import { requireAuth, ownerOnly } from '../middleware/auth.js';
import { issueSession, clearSessionCookie, clientInfo } from '../security/sessionHelpers.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) }).strict();

router.post('/login', async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Enter a valid email and password.' });
    const email = parsed.data.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+passwordHash');
    const match = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    const outcome = user && user.active && match ? 'success' : 'failed';
    await LoginEvent.create({ userId: user?._id, email, outcome, ...clientInfo(request) });
    if (outcome === 'failed') return response.status(401).json({ message: 'Invalid email or password.' });

    // Staff: bump the version AND revoke any previously issued sessions.
    // Owner: retain other active sessions across different devices.
    let currentUser = user;
    if (user.role === 'staff') {
      currentUser = await User.findOneAndUpdate({ _id: user._id, active: true, role: 'staff' },
        { $inc: { sessionVersion: 1 } }, { new: true });
      if (!currentUser) return response.status(401).json({ message: 'Account is inactive.' });
      await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    }
    await issueSession(response, currentUser, request);
    response.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});

router.post('/logout', requireAuth, async (request, response, next) => {
  try {
    await Session.updateOne({ _id: request.sessionRecord._id }, { revokedAt: new Date() });
    clearSessionCookie(response);
    response.json({ message: 'Signed out.' });
  } catch (error) { next(error); }
});
router.get('/me', requireAuth, (request, response) => response.json({ user: request.user }));
router.get('/owner-check', requireAuth, ownerOnly, (_request, response) => response.json({ allowed: true }));

// Changing a password signs out ALL devices (including the current browser).
router.post('/change-password', requireAuth, async (request, response, next) => {
  try {
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'New password must contain 12–128 characters.' });
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return response.status(400).json({ message: 'Choose a different password.' });
    }
    const user = await User.findById(request.user.id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return response.status(401).json({ message: 'Current password is incorrect.' });
    }
    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();
    await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    clearSessionCookie(response);
    response.json({ message: 'Password updated. Sign in again on your devices.' });
  } catch (error) { next(error); }
});
export default router;
