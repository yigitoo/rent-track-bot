const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');

module.exports = function registerStatusCommands(bot) {
  bot.command('durum', async (ctx) => {
    const { month, year } = currentMonth();
    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });

    if (!tenants.length) {
      return ctx.reply('Kiracı bulunamadı.');
    }

    const payments = await Payment.find({ month, year });

    const paymentsByTenant = {};
    for (const p of payments) {
      const tid = p.tenant.toString();
      if (!paymentsByTenant[tid]) paymentsByTenant[tid] = [];
      paymentsByTenant[tid].push(p);
    }

    const paid = [];
    const unpaid = [];

    for (const tenant of tenants) {
      const tid = tenant._id.toString();
      const tenantPayments = paymentsByTenant[tid] || [];

      if (tenantPayments.length > 0) {
        const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        const lastDate = tenantPayments.sort((a, b) => b.date - a.date)[0].date;
        const partial = totalPaid < tenant.rentAmount;
        paid.push({
          name: tenant.name,
          amount: totalPaid,
          expected: tenant.rentAmount,
          date: lastDate,
          partial,
        });
      } else {
        unpaid.push({
          name: tenant.name,
          amount: tenant.rentAmount,
        });
      }
    }

    let text = `--- ${formatMonthYear(month, year)} Ödeme Durumu ---\n\n`;

    if (paid.length) {
      text += `Ödendi (${paid.length}/${tenants.length}):\n`;
      for (const p of paid) {
        const partialTag = p.partial ? ` ⚠️ ${formatCurrency(p.amount)}/${formatCurrency(p.expected)}` : '';
        text += `  ${p.name} - ${formatCurrency(p.amount)} (${formatDate(p.date)})${partialTag}\n`;
      }
    }

    if (unpaid.length) {
      text += `\nÖdenmedi (${unpaid.length}/${tenants.length}):\n`;
      for (const u of unpaid) {
        text += `  ${u.name} - ${formatCurrency(u.amount)}\n`;
      }
    }

    if (!unpaid.length) {
      text += '\nTüm kiracılar ödedi!';
    }

    await ctx.reply(text);
  });
};
