const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatMonthYear, currentMonth } = require('../utils/format');
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

    const paymentsByTenant = {};
    for (const p of payments) {
      const tid = p.tenant.toString();
      if (!paymentsByTenant[tid]) paymentsByTenant[tid] = 0;
      paymentsByTenant[tid] += p.amount;
    }

    const totalExpected = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
    const totalReceived = Object.values(paymentsByTenant).reduce((sum, a) => sum + a, 0);
    const paidCount = Object.keys(paymentsByTenant).length;

    let text = `--- ${formatMonthYear(month, year)} Özet ---\n\n`;
    text += `Beklenen:  ${formatCurrency(totalExpected)} (${tenants.length} kiracı)\n`;
    text += `Alınan:    ${formatCurrency(totalReceived)} (${paidCount} ödeme)\n`;
    text += `Kalan:     ${formatCurrency(totalExpected - totalReceived)}\n\n`;
    text += `Detay:\n`;

    for (const tenant of tenants) {
      const tid = tenant._id.toString();
      const paidAmount = paymentsByTenant[tid] || 0;
      const status = paidAmount >= tenant.rentAmount ? 'ÖDENDİ' :
        paidAmount > 0 ? `EKSİK (${formatCurrency(paidAmount)}/${formatCurrency(tenant.rentAmount)})` : 'ÖDENMEDİ';
      text += `  ${tenant.name} - ${formatCurrency(tenant.rentAmount)} - ${status}\n`;
    }

    await ctx.reply(text);
  });
};
