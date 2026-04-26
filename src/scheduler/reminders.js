const cron = require('node-cron');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { sendMail } = require('../utils/mailer');
const { buildPaymentsByTenant, getMonthlyStatuses } = require('../utils/rentSchedule');

function setupReminders(bot) {
  const chatId = process.env.OWNER_CHAT_ID;
  const tz = process.env.TIMEZONE || 'Europe/Istanbul';

  // Her gün 09:00'da (2. günden itibaren): ödenmemiş kiraları kontrol et
  cron.schedule('0 9 2-31 * *', async () => {
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true });
      const payments = await Payment.find({ month, year });

      const paymentsByTenant = buildPaymentsByTenant(payments);
      const overdue = getMonthlyStatuses(tenants, paymentsByTenant, month, year)
        .filter((status) => !status.paid && status.daysOverdue > 0);

      if (!overdue.length) return;

      const lines = overdue.map((item) =>
        `  - ${item.tenant.name} (${formatCurrency(item.remaining)}) - ${formatDate(item.dueDate)} tarihinden beri ${item.daysOverdue} gün gecikmiş`
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
      const lines = tenants.map((t) => `  - ${t.name}: ${formatCurrency(t.rentAmount)} (her ayın ${t.paymentDay || 1}. günü)`);

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
