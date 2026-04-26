const { Schema, model } = require('mongoose');

const paymentSchema = new Schema({
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  note: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ tenant: 1, year: 1, month: 1 });

module.exports = model('Payment', paymentSchema);
