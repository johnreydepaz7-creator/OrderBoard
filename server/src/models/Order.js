// One order document contains the customer, purchased items and current workflow state.
import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  quantity: { type: Number, required: true, min: 1, max: 10000 },
  unitPrice: { type: Number, required: true, min: 0.01, max: 10000000 },
}, { _id: false });
const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  contact: { type: String, trim: true, maxlength: 100, default: '' },
  source: { type: String, enum: ['Walk-in', 'Phone', 'Facebook', 'Delivery app', 'Other'], required: true },
  items: { type: [itemSchema], validate: [v => v.length > 0 && v.length <= 30, 'Provide 1–30 items.'] },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Pending', 'Confirmed', 'In production', 'Ready', 'Completed', 'Cancelled'], default: 'Pending' },
  paymentStatus: { type: String, enum: ['Unpaid', 'Partially paid', 'Paid'], default: 'Unpaid' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  requestId: {type: String, trim: true, maxlength: 80}, // Identifies one creation attempt; safe to retry.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, optimisticConcurrency: true });
orderSchema.index({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $type: "string" } } });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model('Order', orderSchema);
