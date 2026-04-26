const { Schema, model } = require('mongoose');

const tenantSchema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  rentAmount: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('Tenant', tenantSchema);
