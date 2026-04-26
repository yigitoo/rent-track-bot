const { Telegraf } = require('telegraf');
require('dotenv').config();

module.exports = async (req, res) => {
  try {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const url = `https://${req.headers.host}/api/webhook`;
    await bot.telegram.setWebhook(url);
    res.status(200).json({ ok: true, webhook: url });
  } catch (err) {
    console.error('Set webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};
