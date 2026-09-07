const cron = require('node-cron');
const {
  runDailyReminder,
  runDueReminders,
  runMonthlyReminder,
} = require('../services/notificationService');

function setupReminders() {
  const tz = process.env.TIMEZONE || 'Europe/Istanbul';

  // Kiracı bazlı uyarılar her gün: vadesine bir gün kalan ve geciken ödemeler.
  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await runDueReminders();
      if (result.sent) {
        console.log('Kiracı hatırlatmaları gönderildi:', result.soon.length + result.late.length);
      }
    } catch (error) {
      console.error('Kiracı hatırlatma hatası:', error);
    }
  }, { timezone: tz });

  cron.schedule('0 9 2-31 * *', async () => {
    try {
      const result = await runDailyReminder();
      if (result.sent) console.log('Günlük Telegram özeti gönderildi.');
    } catch (error) {
      console.error('Günlük hatırlatma hatası:', error);
    }
  }, { timezone: tz });

  cron.schedule('0 10 1 * *', async () => {
    try {
      const result = await runMonthlyReminder();
      if (result.sent) console.log('Aylık Telegram özeti gönderildi.');
    } catch (error) {
      console.error('Aylık hatırlatma hatası:', error);
    }
  }, { timezone: tz });

  console.log('Hatırlatmalar planlandı');
}

module.exports = { setupReminders };
