// Everything in this file is for the Owner, not for regular Staff.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { requireAuth, ownerOnly } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, ownerOnly); // Applies to ALL routes below.

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(text => text.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();
const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

// Never send password hashes to the frontend.
function safeUser(user) {
  return {
    id: String(user._id), name: user.name, email: user.email,
    role: user.role, active: user.active, createdAt: user.createdAt,
  };
}

// GET /api/staff: list every Staff account.
router.get('/', async (_request, response, next) => {
  try {
    const staff = await User.find({ role: 'staff' }).sort({ createdAt: -1 }).lean();
    response.json({ staff: staff.map(safeUser) });
  } catch (error) { next(error); }
});

// POST /api/staff: create a new Staff account with a hashed password.
router.post('/', async (request, response, next) => {
  try {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        message: 'Provide a valid name, email, and password of at least 12 characters.',
      });
    }
    const { name, email, password } = parsed.data;
    if (await User.exists({ email })) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await User.create({ name, email, passwordHash, role: 'staff', active: true });
    response.status(201).json({ staff: safeUser(staff) });
  } catch (error) {
    // MongoDB unique index also protects against simultaneous duplicate creates.
    if (error.code === 11000) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }
    next(error);
  }
});

// PATCH /api/staff/:id/status: activate or deactivate a Staff account.
router.patch('/:id/status', async (request, response, next) => {
  try {
    if (!idSchema.safeParse(request.params.id).success) {
      return response.status(400).json({ message: 'Invalid staff ID.' });
    }
    const parsed = z.object({ active: z.boolean() }).strict().safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: 'Invalid account status.' });
    }

    // Incrementing the version revokes any previously issued Staff session.
    const staff = await User.findOneAndUpdate(
      { _id: request.params.id, role: 'staff' },
      { $set: { active: parsed.data.active }, $inc: { sessionVersion: 1 } },
      { new: true, runValidators: true },
    );
    if (!staff) return response.status(404).json({ message: 'Staff account not found.' });
    response.json({ staff: safeUser(staff) });
  } catch (error) { next(error); }
});
export default router;
