// Phase 2.3: protected custom cake production tracking.
import { Router } from 'express';
import { z } from 'zod';
import CakeJob from '../models/CakeJob.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
const statuses = ['Queued', 'Preparing', 'Decorating', 'Ready', 'Completed', 'Cancelled'];
const transitions = {
  Queued: ['Preparing', 'Cancelled'],
  Preparing: ['Decorating', 'Cancelled'],
  Decorating: ['Ready', 'Cancelled'],
  Ready: ['Completed', 'Cancelled'],
  Completed: [], Cancelled: [],
};
const idIsValid = id => /^[0-9a-f]{24}$/i.test(id);
const detailsSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(100),
  cakeDescription: z.string().trim().min(1).max(300),
  size: z.string().trim().min(1).max(80),
  flavor: z.string().trim().min(1).max(100),
  designInstructions: z.string().trim().max(1500),
  quantity: z.number().int().min(1).max(1000),
  dueAt: z.string().datetime({ offset: true }),
}).strict();
function parseDetails(body) {
  const parsed = detailsSchema.safeParse(body);
  if (!parsed.success) return null;
  const dueAt = new Date(parsed.data.dueAt);
  if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() < Date.now() - 60000 || dueAt.getTime() > Date.now() + 365 * 86400000) return null;
  return { ...parsed.data, dueAt };
}
const view = item => ({
  id: String(item._id), customerName: item.customerName, contact: item.contact,
  cakeDescription: item.cakeDescription, size: item.size, flavor: item.flavor,
  designInstructions: item.designInstructions, quantity: item.quantity,
  dueAt: item.dueAt, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt,
});
router.get('/', async (req, res, next) => {
  try {
    const parsed = z.object({
      search: z.string().trim().max(100).default(''),
      status: z.enum(['All', ...statuses]).default('All'),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    }).strict().safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid filters.' });
    const { search, status, page } = parsed.data;
    const filter = {};
    if (status !== 'All') filter.status = status;
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ customerName: { $regex: safeSearch, $options: 'i' } }, { cakeDescription: { $regex: safeSearch, $options: 'i' } }];
    }
    const [items, count] = await Promise.all([
      CakeJob.find(filter).sort({ dueAt: 1, _id: 1 }).skip((page - 1) * 20).limit(20).lean(),
      CakeJob.countDocuments(filter),
    ]);
    res.json({ cakes: items.map(view), count, page, pages: Math.max(1, Math.ceil(count / 20)) });
  } catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try {
    const fields = parseDetails(req.body);
    if (!fields) return res.status(400).json({ message: 'Check all cake details and choose a valid future due date.' });
    // Reuse the same key for retries of ONE submission, not for a new cake job.
    const requestId = req.get('Idempotency-Key');
    if (!requestId || !/^[a-zA-Z0-9-]{12,80}$/.test(requestId)) {
      return res.status(400).json({ message: 'Missing or invalid submission key.' });
    }
    const previous = await CakeJob.findOne({ requestId });
    if (previous) return res.json({ cake: view(previous), duplicatePrevented: true });
    const item = await CakeJob.create({ ...fields, requestId, createdBy: req.user.id, updatedBy: req.user.id });
    res.status(201).json({ cake: view(item) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This cake job was already submitted. Refresh the list.' });
    next(error);
  }
});
router.patch('/:id', async (req, res, next) => {
  try {
    if (!idIsValid(req.params.id)) return res.status(400).json({ message: 'Invalid cake job ID.' });
    const fields = parseDetails(req.body);
    if (!fields) return res.status(400).json({ message: 'Invalid cake details or due date.' });
    const item = await CakeJob.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Cake job not found.' });
    if (['Completed', 'Cancelled'].includes(item.status)) return res.status(409).json({ message: 'Finished or cancelled cake jobs cannot be edited.' });
    Object.assign(item, fields, { updatedBy: req.user.id });
    await item.save();
    res.json({ cake: view(item) });
  } catch (error) { if (error.name === 'VersionError') return res.status(409).json({ message: 'This cake job was changed elsewhere. Refresh and try again.' }); next(error); }
});
router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!idIsValid(req.params.id)) return res.status(400).json({ message: 'Invalid cake job ID.' });
    const parsed = z.object({ status: z.enum(statuses) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid production status.' });
    const item = await CakeJob.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Cake job not found.' });
    if (!transitions[item.status]?.includes(parsed.data.status)) return res.status(409).json({ message: 'That production status change is not allowed.' });
    item.status = parsed.data.status;
    item.updatedBy = req.user.id;
    await item.save();
    res.json({ cake: view(item) });
  } catch (error) { if (error.name === 'VersionError') return res.status(409).json({ message: 'This cake job was changed elsewhere. Refresh and try again.' }); next(error); }
});
export default router;
