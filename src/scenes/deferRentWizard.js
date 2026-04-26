const { Scenes, Markup } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const Tenant = require('../models/tenant');
const { tenantListKeyboard, cancelKeyboard } = require('../utils/keyboard');
const { formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { getTenantDueInfo } = require('../utils/rentSchedule');

dayjs.extend(customParseFormat);

const deferRentWizard = new Scenes.WizardScene(
  'defer_rent_wizard',

  async (ctx) => {
    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
    if (!tenants.length) {
      await ctx.reply('Kiracı bulunamadı. Önce /kiraciekle ile ekleyin.');
      return ctx.scene.leave();
    }
    await ctx.reply('Kirası ertelenecek kiracıyı seçin:', tenantListKeyboard(tenants, 'defer_t'));
    return ctx.wizard.next();
  },

  (ctx) => ctx.wizard.next(),
  (ctx) => ctx.wizard.next(),
  (ctx) => ctx.wizard.next()
);

deferRentWizard.action(/^defer_t:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const tenant = await Tenant.findById(ctx.match[1]);
  if (!tenant) {
    await ctx.reply('Kiracı bulunamadı.');
    return ctx.scene.leave();
  }

  const { month, year } = currentMonth();
  ctx.wizard.state.tenantId = tenant._id.toString();
  ctx.wizard.state.tenantName = tenant.name;

  await ctx.reply(
    'Hangi ayın kirası ertelenecek?',
    Markup.inlineKeyboard([
      Markup.button.callback(formatMonthYear(month, year), 'defer_month_current'),
      Markup.button.callback('Manuel gir', 'defer_month_manual'),
    ])
  );
  ctx.wizard.selectStep(1);
});

deferRentWizard.action('defer_month_current', async (ctx) => {
  await ctx.answerCbQuery();
  const { month, year } = currentMonth();
  ctx.wizard.state.month = month;
  ctx.wizard.state.year = year;
  await askDueDate(ctx);
});

deferRentWizard.action('defer_month_manual', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Ayı girin (AA/YYYY):', cancelKeyboard());
  ctx.wizard.selectStep(1);
});

deferRentWizard.on('text', async (ctx) => {
  const step = ctx.wizard.cursor;
  const input = ctx.message.text.trim();

  if (step === 1) {
    const parsed = dayjs(input, ['MM/YYYY', 'M/YYYY'], true);
    if (!parsed.isValid()) {
      return ctx.reply('Geçersiz format. AA/YYYY kullanın:');
    }

    ctx.wizard.state.month = parsed.month() + 1;
    ctx.wizard.state.year = parsed.year();
    await askDueDate(ctx);
    return;
  }

  if (step === 2) {
    const parsed = dayjs(input, ['DD/MM/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'], true);
    if (!parsed.isValid()) {
      return ctx.reply('Geçersiz tarih. GG/AA/YYYY formatı kullanın:');
    }

    ctx.wizard.state.dueDate = parsed.hour(12).minute(0).second(0).millisecond(0).toDate();
    await ctx.reply('Not ekleyin veya geçmek için "-" yazın:', cancelKeyboard());
    ctx.wizard.selectStep(3);
    return;
  }

  if (step === 3) {
    const note = input === '-' ? '' : input;
    const tenant = await Tenant.findById(ctx.wizard.state.tenantId);
    if (!tenant) {
      await ctx.reply('Kiracı bulunamadı.');
      return ctx.scene.leave();
    }

    tenant.deferments = (tenant.deferments || []).filter((deferment) =>
      deferment.month !== ctx.wizard.state.month || deferment.year !== ctx.wizard.state.year
    );
    tenant.deferments.push({
      month: ctx.wizard.state.month,
      year: ctx.wizard.state.year,
      dueDate: ctx.wizard.state.dueDate,
      note,
    });
    await tenant.save();

    await ctx.reply(
      `Kira ertelendi:\n` +
      `  Kiracı: ${tenant.name}\n` +
      `  Dönem: ${formatMonthYear(ctx.wizard.state.month, ctx.wizard.state.year)}\n` +
      `  Yeni son ödeme: ${formatDate(ctx.wizard.state.dueDate)}` +
      `${note ? `\n  Not: ${note}` : ''}`
    );
    return ctx.scene.leave();
  }
});

async function askDueDate(ctx) {
  const tenant = await Tenant.findById(ctx.wizard.state.tenantId);
  if (!tenant) {
    await ctx.reply('Kiracı bulunamadı.');
    return ctx.scene.leave();
  }

  const dueInfo = getTenantDueInfo(tenant, ctx.wizard.state.month, ctx.wizard.state.year);
  await ctx.reply(
    `Yeni son ödeme tarihini girin (GG/AA/YYYY):\n` +
    `Mevcut son ödeme: ${formatDate(dueInfo.dueDate)}`,
    cancelKeyboard()
  );
  ctx.wizard.selectStep(2);
}

deferRentWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('İptal edildi.');
  return ctx.scene.leave();
});

module.exports = deferRentWizard;
