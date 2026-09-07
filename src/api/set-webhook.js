const { Telegraf } = require('telegraf');
require('dotenv').config();
const { requireWebAuth } = require('../utils/webAuth');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!requireWebAuth(req, res)) return;
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN yapılandırılmamış.' });
    }
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const url = `https://${req.headers.host}/api/webhook`;
    const options = process.env.TELEGRAM_WEBHOOK_SECRET
      ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
      : {};
    await bot.telegram.setWebhook(url, options);
    res.status(200).json({ ok: true, webhook: url, protected: Boolean(options.secret_token) });
  } catch (err) {
    console.error('Set webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};
