const cron = require('node-cron');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatMonthYear, currentMonth, now } = require('../utils/format');
const { sendMail } = require('../utils/mailer');

function setupReminders(bot) {
  const chatId = process.env.OWNER_CHAT_ID;
  const tz = process.env.TIMEZONE || 'Europe/Istanbul';

  // Her gün 09:00'da (2. günden itibaren): ödenmemiş kiraları kontrol et
  cron.schedule('0 9 2-31 * *', async () => {
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true });
      const payments = await Payment.find({ month, year });

      const paidTenantIds = new Set(payments.map((p) => p.tenant.toString()));
      const unpaid = tenants.filter((t) => !paidTenantIds.has(t._id.toString()));

      if (!unpaid.length) return;

      const day = now().date();
      const lines = unpaid.map((t) =>
        `  - ${t.name} (${formatCurrency(t.rentAmount)}) - ${day - 1} gün gecikmiş`
      );

      const message = `Gecikmiş Ödeme Uyarısı (${formatMonthYear(month, year)}):\n${lines.join('\n')}`;

      await bot.telegram.sendMessage(chatId, message);

      await sendMail(
        `Kira Uyarısı - ${formatMonthYear(month, year)}`,
        message
      );
    } catch (err) {
      console.error('Hatırlatma hatası:', err);
    }
  }, { timezone: tz });

  // Her ayın 1'i saat 10:00'da: yeni ay özeti
  cron.schedule('0 10 1 * *', async () => {
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true });
      if (!tenants.length) return;

      const total = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
      const lines = tenants.map((t) => `  - ${t.name}: ${formatCurrency(t.rentAmount)}`);

      const message = `Yeni Ay - ${formatMonthYear(month, year)}\n\n` +
        `Beklenen toplam: ${formatCurrency(total)}\n` +
        `Kiracılar:\n${lines.join('\n')}`;

      await bot.telegram.sendMessage(chatId, message);

      await sendMail(
        `Kira Özeti - ${formatMonthYear(month, year)}`,
        message
      );
    } catch (err) {
      console.error('Aylık hatırlatma hatası:', err);
    }
  }, { timezone: tz });

  console.log('Hatırlatmalar planlandı');
}

module.exports = { setupReminders };
