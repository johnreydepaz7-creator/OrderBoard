// Phase 2.4: one protected, date-scoped view of upcoming bakery work.
import { Router } from 'express';
import { z } from 'zod';
import CakeJob from '../models/CakeJob.js';
import Reservation from '../models/Reservation.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
// These are in-app reminders, not external email or push notifications.
// Return active work due within 24 hours plus any overdue active work.
router.get('/reminders', async (req, res, next) => {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [cakes, reservations] = await Promise.all([
      CakeJob.find({ dueAt: { $lte: horizon }, status: { $nin: ['Completed', 'Cancelled'] } }).sort({ dueAt: 1 }).limit(100).lean(),
      Reservation.find({ pickupAt: { $lte: horizon }, status: { $nin: ['Collected', 'Cancelled'] } }).sort({ pickupAt: 1 }).limit(100).lean(),
    ]);
    const items = [
      ...cakes.map(c => ({ id: String(c._id), type: 'Cake', at: c.dueAt, customer: c.customerName, detail: c.cakeDescription, status: c.status })),
      ...reservations.map(r => ({ id: String(r._id), type: 'Reservation', at: r.pickupAt, customer: r.customerName, detail: r.description, status: r.status })),
    ].map(item => ({ ...item, urgency: new Date(item.at) < now ? 'Overdue' : 'Due within 24 hours' }));
    items.sort((a, b) => new Date(a.at) - new Date(b.at));
    res.json({ items, truncated: cakes.length === 100 || reservations.length === 100, checkedAt: now });
  } catch (error) { next(error); }
});
router.get('/', async (req, res, next) => {
  try {
    const parsed=z.object({start:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),days:z.coerce.number().int().min(1).max(31).default(7)}).strict().safeParse(req.query);
    if(!parsed.success)return res.status(400).json({message:'Provide a start date (YYYY-MM-DD) and 1–31 days.'});
    const start=new Date(`${parsed.data.start}T00:00:00.000+08:00`); // Philippine midnight
    if(Number.isNaN(start.getTime())||new Date(start.getTime()+8*3600000).toISOString().slice(0,10)!==parsed.data.start)return res.status(400).json({message:'Invalid schedule date.'});
    const end=new Date(start.getTime()+parsed.data.days*86400000);
    const [cakes,reservations]=await Promise.all([
      CakeJob.find({dueAt:{$gte:start,$lt:end},status:{$nin:['Cancelled','Completed']}}).sort({dueAt:1}).limit(1000).lean(),
      Reservation.find({pickupAt:{$gte:start,$lt:end},status:{$nin:['Cancelled','Collected']}}).sort({pickupAt:1}).limit(1000).lean(),
    ]);
    const items=[...cakes.map(c=>({id:String(c._id),type:'Cake',at:c.dueAt,customer:c.customerName,detail:c.cakeDescription,quantity:c.quantity,status:c.status})),...reservations.map(r=>({id:String(r._id),type:'Reservation',at:r.pickupAt,customer:r.customerName,detail:r.description,quantity:r.quantity,status:r.status}))];
    items.sort((a,b)=>new Date(a.at)-new Date(b.at));
    res.json({items,truncated:cakes.length===1000||reservations.length===1000});
  }catch(error){next(error)}
});
export default router;
