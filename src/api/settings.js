const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const { requireWebAuth } = require('../utils/webAuth');
const { getSettings, saveSettings } = require('../services/settings');
const { isTelegramConfigured } = require('../services/telegram');
const { isMailConfigured } = require('../utils/mailer');

function payload(settings) {
  return {
    settings,
    channels: {
      telegramTokenSet: isTelegramConfigured(),
      emailTransportSet: isMailConfigured(),
      telegramReady: isTelegramConfigured() && settings.telegramChatIds.length > 0,
      emailReady: isMailConfigured() && settings.emailRecipients.length > 0,
    },
  };
}

module.exports = async (req, res) => {
  if (!['GET', 'PUT', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      return res.status(200).json(payload(await getSettings()));
    }

    const settings = await saveSettings({
      emailRecipients: req.body?.emailRecipients,
      telegramChatIds: req.body?.telegramChatIds,
    });
    return res.status(200).json(payload(settings));
  } catch (error) {
    console.error('Settings API error:', error);
    const isValidation = /Geçersiz|eklenebilir/.test(error.message || '');
    return res.status(isValidation ? 400 : 500).json({
      error: error.message || 'Ayarlar kaydedilemedi.',
    });
  }
};
