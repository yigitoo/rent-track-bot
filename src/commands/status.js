const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { buildPaymentsByTenant, getMonthlyStatuses } = require('../utils/rentSchedule');

module.exports = function registerStatusCommands(bot) {
  bot.command('durum', async (ctx) => {
    const { month, year } = currentMonth();
    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });

    if (!tenants.length) {
      return ctx.reply('Kiracı bulunamadı.');
    }

    const payments = await Payment.find({ month, year });

    const paymentsByTenant = buildPaymentsByTenant(payments);
    const statuses = getMonthlyStatuses(tenants, paymentsByTenant, month, year);
    const paid = statuses.filter((s) => s.paid);
    const unpaid = statuses.filter((s) => !s.paid);

    let text = `--- ${formatMonthYear(month, year)} Ödeme Durumu ---\n\n`;

    if (paid.length) {
      text += `Ödendi (${paid.length}/${tenants.length}):\n`;
      for (const p of paid) {
        text += `  ${p.tenant.name} - ${formatCurrency(p.totalPaid)} (${formatDate(p.lastDate)})\n`;
      }
    }

    if (unpaid.length) {
      text += `\nÖdenmedi (${unpaid.length}/${tenants.length}):\n`;
      for (const u of unpaid) {
        const partialTag = u.partial ? ` - Eksik: ${formatCurrency(u.totalPaid)}/${formatCurrency(u.expected)}` : '';
        const deferredTag = u.isDeferred ? ' - Ertelendi' : '';
        const dueTag = u.daysUntilDue < 0
          ? ` - ${u.daysOverdue} gün gecikmiş`
          : ` - Son ödeme: ${formatDate(u.dueDate)}`;
        text += `  ${u.tenant.name} - ${formatCurrency(u.remaining)}${partialTag}${dueTag}${deferredTag}\n`;
      }
    }

    if (!unpaid.length) {
      text += '\nTüm kiracılar ödedi!';
    }

    await ctx.reply(text);
  });
};
