const Setting = require('../models/setting');

const SETTING_KEY = 'app';
const CACHE_MS = 15000;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const CHAT_ID_PATTERN = /^(-?\d{5,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

let cache = null;
let cachedAt = 0;

function splitList(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(list) {
  return Array.from(new Set(list));
}

function envEmailRecipients() {
  return unique(splitList(process.env.EMAIL_TO));
}

function envTelegramChatIds() {
  return unique(splitList(process.env.OWNER_CHAT_ID));
}

function shape(stored) {
  const emailOverride = unique(stored?.emailRecipients || []);
  const telegramOverride = unique(stored?.telegramChatIds || []);
  const emailDefaults = envEmailRecipients();
  const telegramDefaults = envTelegramChatIds();

  return {
    emailRecipients: emailOverride.length ? emailOverride : emailDefaults,
    telegramChatIds: telegramOverride.length ? telegramOverride : telegramDefaults,
    usesEmailDefaults: emailOverride.length === 0,
    usesTelegramDefaults: telegramOverride.length === 0,
    emailDefaults,
    telegramDefaults,
  };
}

function invalidate() {
  cache = null;
  cachedAt = 0;
}

/* Veritabanına ulaşılamazsa ayar okumak bildirim göndermeyi engellememeli;
   o durumda ortam değişkenindeki hedeflere düşülür. */
async function getSettings() {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  let stored = null;
  try {
    stored = await Setting.findOne({ key: SETTING_KEY }).lean();
  } catch (error) {
    console.error('Ayarlar okunamadı, ortam değişkenlerine düşülüyor:', error.message);
    return shape(null);
  }

  cache = shape(stored);
  cachedAt = Date.now();
  return cache;
}

function validate({ emailRecipients, telegramChatIds }) {
  const emails = unique(Array.isArray(emailRecipients) ? emailRecipients.map((v) => String(v).trim()).filter(Boolean) : []);
  const chatIds = unique(Array.isArray(telegramChatIds) ? telegramChatIds.map((v) => String(v).trim()).filter(Boolean) : []);

  if (emails.length > 20) throw new Error('En fazla 20 e-posta adresi eklenebilir.');
  if (chatIds.length > 20) throw new Error('En fazla 20 Telegram hedefi eklenebilir.');

  const badEmail = emails.find((value) => !EMAIL_PATTERN.test(value));
  if (badEmail) throw new Error('Geçersiz e-posta adresi: ' + badEmail);

  const badChat = chatIds.find((value) => !CHAT_ID_PATTERN.test(value));
  if (badChat) throw new Error('Geçersiz Telegram hedefi: ' + badChat + ' (sayısal sohbet kimliği ya da @kullaniciadi)');

  return { emails, chatIds };
}

async function saveSettings(input) {
  const { emails, chatIds } = validate(input);
  await Setting.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set: { emailRecipients: emails, telegramChatIds: chatIds } },
    { upsert: true, new: true }
  );
  invalidate();
  return getSettings();
}

module.exports = {
  envEmailRecipients,
  envTelegramChatIds,
  getSettings,
  invalidate,
  saveSettings,
  splitList,
};
