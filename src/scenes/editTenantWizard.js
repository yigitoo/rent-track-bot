const { Scenes, Markup } = require('telegraf');
const Tenant = require('../models/tenant');
const { formatCurrency } = require('../utils/format');
const { tenantListKeyboard, cancelKeyboard } = require('../utils/keyboard');
const { normalizePaymentDay } = require('../utils/rentSchedule');
const { notifyTenantUpdated } = require('../services/notificationService');

const editTenantWizard = new Scenes.WizardScene(
  'edit_tenant_wizard',

  async (ctx) => {
    const tenants = await Tenant.find({ isActive: true });
    if (!tenants.length) {
      await ctx.reply('Kiracı bulunamadı.');
      return ctx.scene.leave();
    }
    await ctx.reply('Düzenlenecek kiracıyı seçin:', tenantListKeyboard(tenants, 'edit_t'));
    return ctx.wizard.next();
  },

  (ctx) => {},
  (ctx) => {}
);

editTenantWizard.action(/^edit_t:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.wizard.state.tenantId = ctx.match[1];
  await ctx.reply(
    'Ne düzenlemek istiyorsunuz?',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Ad', 'edit_f:name'),
        Markup.button.callback('Adres', 'edit_f:address'),
      ],
      [
        Markup.button.callback('Kira Tutarı', 'edit_f:rentAmount'),
        Markup.button.callback('Ödeme Günü', 'edit_f:paymentDay'),
      ],
    ])
  );
  ctx.wizard.selectStep(2);
});

editTenantWizard.action(/^edit_f:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.wizard.state.field = ctx.match[1];
  const labels = { name: 'ad', address: 'adres', rentAmount: 'kira tutarı', paymentDay: 'ödeme günü' };
  await ctx.reply(`Yeni ${labels[ctx.wizard.state.field]} girin:`, cancelKeyboard());
  ctx.wizard.selectStep(3);
});

editTenantWizard.on('text', async (ctx) => {
  const { field, tenantId } = ctx.wizard.state;
  if (!field || !tenantId) return;

  let value = ctx.message.text.trim();
  if (field === 'rentAmount') {
    value = parseFloat(value);
    if (isNaN(value) || value <= 0) {
      return ctx.reply('Geçersiz tutar. Pozitif bir sayı girin:');
    }
  }
  if (field === 'paymentDay') {
    value = normalizePaymentDay(value);
    if (!value) {
      return ctx.reply('Geçersiz gün. 1-31 arasında bir sayı girin:');
    }
  }

  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { [field]: value },
    { new: true }
  );

  await notifyTenantUpdated(tenant);
  await ctx.reply(
    `Güncellendi:\n` +
    `  Ad: ${tenant.name}\n` +
    `  Adres: ${tenant.address}\n` +
    `  Kira: ${formatCurrency(tenant.rentAmount)}\n` +
    `  Ödeme günü: Her ayın ${tenant.paymentDay}. günü`
  );
  return ctx.scene.leave();
});

editTenantWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('İptal edildi.');
  return ctx.scene.leave();
});

module.exports = editTenantWizard;
