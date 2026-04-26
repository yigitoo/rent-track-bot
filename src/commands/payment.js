const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear } = require('../utils/format');
const { tenantListKeyboard } = require('../utils/keyboard');
const { Markup } = require('telegraf');

module.exports = function registerPaymentCommands(bot) {
  bot.command('odemeekle', (ctx) => ctx.scene.enter('add_payment_wizard'));

  bot.command('odemeler', async (ctx) => {
    const tenants = await Tenant.find({ isActive: true });
    if (!tenants.length) {
      return ctx.reply('Kiracı bulunamadı.');
    }
    await ctx.reply('Geçmişini görmek istediğiniz kiracıyı seçin:', tenantListKeyboard(tenants, 'hist_t'));
  });

  bot.action(/^hist_t:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showPaymentHistory(ctx, ctx.match[1], 0);
  });

  bot.action(/^hist_p:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showPaymentHistory(ctx, ctx.match[1], parseInt(ctx.match[2]));
  });

  async function showPaymentHistory(ctx, tenantId, page) {
    const perPage = 10;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return ctx.reply('Kiracı bulunamadı.');

    const total = await Payment.countDocuments({ tenant: tenantId });
    const payments = await Payment.find({ tenant: tenantId })
      .sort({ date: -1 })
      .skip(page * perPage)
      .limit(perPage);

    if (!payments.length && page === 0) {
      return ctx.reply(`${tenant.name} için ödeme kaydı bulunamadı.`);
    }

    const lines = payments.map((p) =>
      `  ${formatDate(p.date)} - ${formatCurrency(p.amount)} (${formatMonthYear(p.month, p.year)})${p.note ? ` [${p.note}]` : ''}`
    );

    let text = `Ödeme geçmişi: ${tenant.name}\n\n${lines.join('\n')}`;

    const totalPages = Math.ceil(total / perPage);
    if (totalPages > 1) {
      text += `\n\nSayfa ${page + 1}/${totalPages}`;
    }

    const navButtons = [];
    if (page > 0) {
      navButtons.push(Markup.button.callback('← Önceki', `hist_p:${tenantId}:${page - 1}`));
    }
    if (page + 1 < totalPages) {
      navButtons.push(Markup.button.callback('Sonraki →', `hist_p:${tenantId}:${page + 1}`));
    }

    if (navButtons.length) {
      await ctx.reply(text, Markup.inlineKeyboard([navButtons]));
    } else {
      await ctx.reply(text);
    }
  }
};
