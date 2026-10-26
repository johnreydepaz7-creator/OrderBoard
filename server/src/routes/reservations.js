// Phase 2.2: Reservation API. Every endpoint requires a live login session.
import { Router } from 'express';
import { z } from 'zod';
import Reservation from '../models/Reservation.js';
import { requireAuth } from '../middleware/auth.js';
const router=Router();
router.use(requireAuth);
const statuses=['Reserved','Confirmed','Collected','Cancelled'];
const fields=z.object({
 customerName:z.string().trim().min(1).max(120),contact:z.string().trim().max(100),
 description:z.string().trim().min(1).max(300),quantity:z.number().int().min(1).max(10000),
 pickupAt:z.string().datetime({offset:true}),notes:z.string().trim().max(1000),
}).strict();
const validId=id=>/^[a-f\d]{24}$/i.test(id);
// Convert MongoDB documents into the consistent format expected by the frontend.
// Works for both ordinary Mongoose documents and .lean() query results.
function view(reservation) {
 return {
  id: String(reservation._id),
  customerName: reservation.customerName,
  contact: reservation.contact,
  description: reservation.description,
  quantity: reservation.quantity,
  pickupAt: reservation.pickupAt,
  notes: reservation.notes,
  status: reservation.status,
  createdAt: reservation.createdAt,
  updatedAt: reservation.updatedAt,
 };
}
// There is no pickup slot capacity limit. Staff can accept as many as needed.
function parseDetails(body){
 const parsed=fields.safeParse(body);
 if(!parsed.success)return null;
 const date=new Date(parsed.data.pickupAt);
 if(!Number.isFinite(date.getTime())||date.getTime()<Date.now()-60000||date.getTime()>Date.now()+365*86400000)return null;
 return {...parsed.data,pickupAt:date};
}
router.get('/',async(req,res,next)=>{try{
 const parsed=z.object({search:z.string().trim().max(100).default(''),status:z.enum(['All',...statuses]).default('All'),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().safeParse(req.query);
 if(!parsed.success)return res.status(400).json({message:'Invalid filters.'});
 const {search,status,page}=parsed.data;const query={};
 if(status!=='All')query.status=status;
 if(search)query.customerName={$regex:search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};
 const [items,count]=await Promise.all([Reservation.find(query).sort({pickupAt:1,_id:1}).skip((page-1)*20).limit(20).lean(),Reservation.countDocuments(query)]);
 res.json({reservations:items.map(view),count,page,pages:Math.max(1,Math.ceil(count/20))});
}catch(err){next(err)}});
router.post('/',async(req,res,next)=>{try{
 const data=parseDetails(req.body);if(!data)return res.status(400).json({message:'Check reservation fields and choose a pickup within the next year.'});
 const requestId=req.get('Idempotency-Key');
 if(!requestId||!/^[a-zA-Z0-9-]{12,80}$/.test(requestId))return res.status(400).json({message:'Missing or invalid submission key.'});
 const prior=await Reservation.findOne({requestId});if(prior)return res.json({reservation:view(prior),duplicatePrevented:true});
 const item=await Reservation.create({...data,requestId,createdBy:req.user.id,updatedBy:req.user.id});res.status(201).json({reservation:view(item)});
}catch(err){if(err.code===11000)return res.status(409).json({message:'This reservation has already been submitted. Refresh to view it.'});next(err)}});
router.patch('/:id',async(req,res,next)=>{try{
 if(!validId(req.params.id))return res.status(400).json({message:'Invalid reservation ID.'});
 const data=parseDetails(req.body);if(!data)return res.status(400).json({message:'Invalid reservation details or pickup date.'});
 const item=await Reservation.findById(req.params.id);if(!item)return res.status(404).json({message:'Reservation not found.'});
 if(['Cancelled','Collected'].includes(item.status))return res.status(409).json({message:'This reservation can no longer be edited.'});
 Object.assign(item,data,{updatedBy:req.user.id});await item.save();res.json({reservation:view(item)});
}catch(err){if(err.name==='VersionError')return res.status(409).json({message:'Reservation changed elsewhere; refresh.'});next(err)}});
router.patch('/:id/status',async(req,res,next)=>{try{
 if(!validId(req.params.id))return res.status(400).json({message:'Invalid reservation ID.'});
 const parsed=z.object({status:z.enum(statuses)}).strict().safeParse(req.body);
 if(!parsed.success)return res.status(400).json({message:'Invalid status.'});
 const item=await Reservation.findById(req.params.id);if(!item)return res.status(404).json({message:'Reservation not found.'});
 const allowed={Reserved:['Confirmed','Cancelled'],Confirmed:['Collected','Cancelled'],Collected:[],Cancelled:[]};
 if(!allowed[item.status].includes(parsed.data.status))return res.status(409).json({message:'That status change is not allowed.'});
 item.status=parsed.data.status;item.updatedBy=req.user.id;await item.save();res.json({reservation:view(item)});
}catch(err){if(err.name==='VersionError')return res.status(409).json({message:'Reservation changed elsewhere; refresh.'});next(err)}});
export default router;
