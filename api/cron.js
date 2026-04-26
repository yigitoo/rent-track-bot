const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const connectDB = require('../src/db');
const Tenant = require('../src/models/tenant');
const Payment = require('../src/models/payment');
const { formatCurrency, formatMonthYear, currentMonth, now } = require('../src/utils/format');
const { sendHtmlMail } = require('../src/utils/mailer');
const { buildReportHtml } = require('../src/utils/emailTemplate');

module.exports = async (req, res) => {
  try {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    const chatId = process.env.OWNER_CHAT_ID;
    const { month, year } = currentMonth();
    const day = now().date();

    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
    if (!tenants.length) {
      return res.status(200).json({ message: 'No tenants' });
    }

    const payments = await Payment.find({ month, year });

    const paymentsByTenant = {};
    for (const p of payments) {
      const tid = p.tenant.toString();
      if (!paymentsByTenant[tid]) paymentsByTenant[tid] = [];
      paymentsByTenant[tid].push(p);
    }

    const totalExpected = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

    const html = buildReportHtml({ month, year, tenants, paymentsByTenant, totalExpected, totalReceived });

    if (day === 1) {
      const total = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
      const lines = tenants.map((t) => `  - ${t.name}: ${formatCurrency(t.rentAmount)}`);
      const message = `Yeni Ay - ${formatMonthYear(month, year)}\n\nBeklenen toplam: ${formatCurrency(total)}\nKiracılar:\n${lines.join('\n')}`;

      await bot.telegram.sendMessage(chatId, message);
      await sendHtmlMail(`Kira Özeti - ${formatMonthYear(month, year)}`, html);

      return res.status(200).json({ message: 'Monthly summary sent' });
    }

    const paidTenantIds = new Set(payments.map((p) => p.tenant.toString()));
    const unpaid = tenants.filter((t) => !paidTenantIds.has(t._id.toString()));

    if (!unpaid.length) {
      return res.status(200).json({ message: 'All paid' });
    }

    const lines = unpaid.map((t) =>
      `  - ${t.name} (${formatCurrency(t.rentAmount)}) - ${day - 1} gün gecikmiş`
    );
    const message = `Gecikmiş Ödeme Uyarısı (${formatMonthYear(month, year)}):\n${lines.join('\n')}`;

    await bot.telegram.sendMessage(chatId, message);
    await sendHtmlMail(`Kira Uyarısı - ${formatMonthYear(month, year)}`, html);

    res.status(200).json({ message: 'Late payment alert sent' });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
