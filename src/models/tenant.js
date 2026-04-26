const { Schema, model } = require('mongoose');

const tenantSchema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  rentAmount: { type: Number, required: true, min: 0 },
  paymentDay: { type: Number, required: true, min: 1, max: 31, default: 1 },
  deferments: [{
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    note: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
  }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Tenant', tenantSchema);
