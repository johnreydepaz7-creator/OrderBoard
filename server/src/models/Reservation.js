// A reservation holds a bakery pickup slot; it is separate from a paid order.
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 customerName: { type:String,required:true,trim:true,maxlength:120 },
 contact: {type:String,default:'',maxlength:100},
 description: {type:String,required:true,maxlength:300},
 quantity: {type:Number,required:true,min:1,max:10000},
 pickupAt: {type:Date,required:true,index:true},
 notes: {type:String,default:'',maxlength:1000},
 status: {type:String,enum:['Reserved','Confirmed','Collected','Cancelled'],default:'Reserved',index:true},
 requestId: {type: String, trim: true, maxlength: 80}, // Identifies one creation attempt; safe to retry.
 createdBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 updatedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
},{timestamps:true,optimisticConcurrency:true});
schema.index({requestId:1},{unique:true,partialFilterExpression:{requestId:{$type:"string"}}});
export default mongoose.model('Reservation',schema);
