const { Scenes, Markup } = require('telegraf');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { requireMoney } = require('../utils/money');
const { formatCurrency, formatDate, formatMonthYear, now } = require('../utils/format');
const { tenantListKeyboard, confirmKeyboard, cancelKeyboard } = require('../utils/keyboard');
const { notifyPaymentRecorded } = require('../services/notificationService');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const addPaymentWizard = new Scenes.WizardScene(
  'add_payment_wizard',

  async (ctx) => {
    const tenants = await Tenant.find({ isActive: true });
    if (!tenants.length) {
      await ctx.reply('Kiracı bulunamadı. Önce /kiraciekle ile ekleyin.');
      return ctx.scene.leave();
    }
    await ctx.reply('Kiracı seçin:', tenantListKeyboard(tenants, 'pay_t'));
    return ctx.wizard.next();
  },

  (ctx) => ctx.wizard.next(),
  (ctx) => ctx.wizard.next(),
  (ctx) => ctx.wizard.next()
);

addPaymentWizard.action(/^pay_t:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const tenant = await Tenant.findById(ctx.match[1]);
  if (!tenant) {
    await ctx.reply('Kiracı bulunamadı.');
    return ctx.scene.leave();
  }
  ctx.wizard.state.tenantId = tenant._id.toString();
  ctx.wizard.state.tenantName = tenant.name;
  ctx.wizard.state.expectedAmount = tenant.rentAmount;
  await ctx.reply(
    `Ödeme tutarını girin (beklenen: ${formatCurrency(tenant.rentAmount)}):`,
    cancelKeyboard()
  );
  ctx.wizard.selectStep(1);
});

addPaymentWizard.on('text', async (ctx) => {
  const step = ctx.wizard.cursor;

  if (step === 1) {
    let amount;
    try {
      amount = requireMoney(ctx.message.text, 'payment');
    } catch (error) {
      return ctx.reply(error.message + '\nTekrar deneyin:');
    }
    ctx.wizard.state.amount = amount;
    await ctx.reply(
      'Ödeme tarihi?',
      Markup.inlineKeyboard([
        Markup.button.callback('Bugün', 'pay_date_today'),
        Markup.button.callback('Manuel gir', 'pay_date_manual'),
      ])
    );
    ctx.wizard.selectStep(2);
    return;
  }

  if (step === 2) {
    const parsed = dayjs(ctx.message.text.trim(), ['DD/MM/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'], true);
    if (!parsed.isValid()) {
      return ctx.reply('Geçersiz tarih. GG/AA/YYYY formatı kullanın:');
    }
    ctx.wizard.state.date = parsed.toDate();
    ctx.wizard.state.payMonth = parsed.month() + 1;
    ctx.wizard.state.payYear = parsed.year();
    return showConfirmation(ctx);
  }

  if (step === 3) {
    const input = ctx.message.text.trim();
    if (input) {
      const parsed = dayjs(input, ['MM/YYYY', 'M/YYYY'], true);
      if (!parsed.isValid()) {
        return ctx.reply('Geçersiz format. AA/YYYY kullanın veya boş bırakın (bu ay):');
      }
      ctx.wizard.state.payMonth = parsed.month() + 1;
      ctx.wizard.state.payYear = parsed.year();
    }
    return showConfirmation(ctx);
  }
});

addPaymentWizard.action('pay_date_today', async (ctx) => {
  await ctx.answerCbQuery();
  const d = now();
  ctx.wizard.state.date = d.toDate();
  ctx.wizard.state.payMonth = d.month() + 1;
  ctx.wizard.state.payYear = d.year();

  await ctx.reply(
    'Bu ödeme hangi aya ait?',
    Markup.inlineKeyboard([
      Markup.button.callback(formatMonthYear(d.month() + 1, d.year()), 'pay_month_current'),
      Markup.button.callback('Manuel gir', 'pay_month_manual'),
    ])
  );
  ctx.wizard.selectStep(3);
});

addPaymentWizard.action('pay_date_manual', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Tarihi girin (GG/AA/YYYY):', cancelKeyboard());
});

addPaymentWizard.action('pay_month_current', async (ctx) => {
  await ctx.answerCbQuery();
  return showConfirmation(ctx);
});

addPaymentWizard.action('pay_month_manual', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Ayı girin (AA/YYYY):', cancelKeyboard());
});

async function showConfirmation(ctx) {
  const s = ctx.wizard.state;
  const partial = s.amount < s.expectedAmount ? ' ⚠️ EKSİK ÖDEME' : '';
  await ctx.reply(
    `Ödemeyi onaylayın:\n` +
    `  Kiracı: ${s.tenantName}\n` +
    `  Tutar: ${formatCurrency(s.amount)}${partial}\n` +
    `  Tarih: ${formatDate(s.date)}\n` +
    `  Dönem: ${formatMonthYear(s.payMonth, s.payYear)}`,
    confirmKeyboard('pay_confirm', 'pay_cancel')
  );
  ctx.wizard.selectStep(4);
}

addPaymentWizard.action('pay_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  const s = ctx.wizard.state;
  const payment = await Payment.create({
    tenant: s.tenantId,
    amount: s.amount,
    date: s.date,
    month: s.payMonth,
    year: s.payYear,
    source: 'telegram',
  });
  const tenant = await Tenant.findById(s.tenantId);
  if (tenant) await notifyPaymentRecorded(payment, tenant, { source: 'telegram' });
  await ctx.reply('Ödeme kaydedildi.', Markup.inlineKeyboard([
    [Markup.button.callback('🧾 Ödeme tablosu', 'nav:grid')],
    [Markup.button.callback('🏠 Ana menü', 'nav:home')],
  ]));
  return ctx.scene.leave();
});

addPaymentWizard.action('pay_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('İptal edildi.');
  return ctx.scene.leave();
});

addPaymentWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('İptal edildi.');
  return ctx.scene.leave();
});

module.exports = addPaymentWizard;
