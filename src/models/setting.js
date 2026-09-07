const { Schema, model } = require('mongoose');

/* Uygulama ayarları tek bir belgede durur (key: 'app').
   Liste boşsa ortam değişkenindeki değer geçerlidir; bu yüzden alanı
   temizlemek "varsayılana dön" anlamına gelir. */
const settingSchema = new Schema({
  key: { type: String, required: true, unique: true, default: 'app' },
  emailRecipients: { type: [String], default: [] },
  telegramChatIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = model('Setting', settingSchema);
