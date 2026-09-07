const { Telegraf } = require('telegraf');
const { getSettings } = require('./settings');

let bot;

function getTelegramBot() {
  if (bot) return bot;
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN yapılandırılmamış.');
  }
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  return bot;
}

/* Bot jetonu var mı. Hedef sohbetler ayarlardan gelir. */
function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/* Bir hedefe ulaşılamazsa (kullanıcı botu engellemiş olabilir) diğerleri
   yine de denenir; en az biri gittiyse bildirim gönderilmiş sayılır. */
async function sendOwnerMessage(text, extra = {}) {
  if (!isTelegramConfigured()) return { sent: false, reason: 'not_configured' };

  const { telegramChatIds } = await getSettings();
  if (!telegramChatIds.length) return { sent: false, reason: 'no_recipients' };

  const results = [];
  for (const chatId of telegramChatIds) {
    try {
      const message = await getTelegramBot().telegram.sendMessage(
        chatId,
        text,
        { disable_web_page_preview: true, ...extra }
      );
      results.push({ chatId, ok: true, messageId: message.message_id });
    } catch (error) {
      console.error('Telegram mesajı gönderilemedi (' + chatId + '):', error.message);
      results.push({ chatId, ok: false, error: error.message });
    }
  }

  const delivered = results.filter((item) => item.ok);
  if (!delivered.length) {
    return { sent: false, reason: 'telegram_error', error: results[0]?.error, results };
  }

  return {
    sent: true,
    messageId: delivered[0].messageId,
    delivered: delivered.length,
    total: results.length,
    recipients: telegramChatIds,
    results,
  };
}

module.exports = { getTelegramBot, isTelegramConfigured, sendOwnerMessage };
