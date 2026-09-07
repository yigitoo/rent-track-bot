const { Schema, model } = require('mongoose');

const notificationSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  channel: { type: String, enum: ['telegram', 'email', 'web'], default: 'telegram' },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
  recipient: { type: String, default: '' },
  error: { type: String, default: '' },
  sentAt: { type: Date, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = model('Notification', notificationSchema);
