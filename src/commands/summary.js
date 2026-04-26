const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { buildPaymentsByTenant, getMonthlyStatuses } = require('../utils/rentSchedule');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

module.exports = function registerSummaryCommands(bot) {
  bot.command('ozet', async (ctx) => {
    let month, year;

    const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (args) {
      const parsed = dayjs(args, ['MM/YYYY', 'M/YYYY'], true);
      if (!parsed.isValid()) {
        return ctx.reply('Geçersiz format. Kullanım: /ozet AA/YYYY');
      }
      month = parsed.month() + 1;
      year = parsed.year();
    } else {
      ({ month, year } = currentMonth());
    }

    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
    if (!tenants.length) {
      return ctx.reply('Kiracı bulunamadı.');
    }

    const payments = await Payment.find({ month, year });

    const paymentsByTenant = buildPaymentsByTenant(payments);
    const statuses = getMonthlyStatuses(tenants, paymentsByTenant, month, year);

    const totalExpected = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidCount = statuses.filter((s) => s.paid).length;

    let text = `--- ${formatMonthYear(month, year)} Özet ---\n\n`;
    text += `Beklenen:  ${formatCurrency(totalExpected)} (${tenants.length} kiracı)\n`;
    text += `Alınan:    ${formatCurrency(totalReceived)} (${paidCount} ödeme)\n`;
    text += `Kalan:     ${formatCurrency(totalExpected - totalReceived)}\n\n`;
    text += `Detay:\n`;

    for (const item of statuses) {
      const status = item.paid ? 'ÖDENDİ' :
        item.partial ? `EKSİK (${formatCurrency(item.totalPaid)}/${formatCurrency(item.expected)})` :
        item.status === 'overdue' ? `GECİKTİ (${item.daysOverdue} gün)` :
        item.status === 'upcoming' ? `YAKLAŞIYOR (${formatDate(item.dueDate)})` :
        `ÖDENECEK (${formatDate(item.dueDate)})`;
      const deferredTag = item.isDeferred ? ' - ERTELENDİ' : '';
      text += `  ${item.tenant.name} - ${formatCurrency(item.expected)} - ${status}${deferredTag}\n`;
    }

    await ctx.reply(text);
  });
};
