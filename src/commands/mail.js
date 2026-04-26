const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatMonthYear, currentMonth } = require('../utils/format');
const { sendHtmlMail } = require('../utils/mailer');
const { buildReportHtml } = require('../utils/emailTemplate');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

module.exports = function registerMailCommands(bot) {
  bot.command('mailgonder', async (ctx) => {
    let month, year;

    const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (args) {
      const parsed = dayjs(args, ['MM/YYYY', 'M/YYYY'], true);
      if (!parsed.isValid()) {
        return ctx.reply('Geçersiz format. Kullanım: /mailgonder AA/YYYY');
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

    await ctx.reply('Mail hazırlanıyor...');

    const payments = await Payment.find({ month, year });

    const paymentsByTenant = {};
    for (const p of payments) {
      const tid = p.tenant.toString();
      if (!paymentsByTenant[tid]) paymentsByTenant[tid] = [];
      paymentsByTenant[tid].push(p);
    }

    const totalExpected = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

    const html = buildReportHtml({
      month,
      year,
      tenants,
      paymentsByTenant,
      totalExpected,
      totalReceived,
    });

    const subject = `Kira Raporu - ${formatMonthYear(month, year)}`;

    try {
      await sendHtmlMail(subject, html);
      await ctx.reply(`Mail gönderildi: ${process.env.EMAIL_TO}`);
    } catch (err) {
      console.error('Mail error:', err);
      await ctx.reply(`Mail gönderilemedi: ${err.message}`);
    }
  });
};
