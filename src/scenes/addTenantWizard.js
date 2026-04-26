const { Scenes } = require('telegraf');
const Tenant = require('../models/tenant');
const { formatCurrency } = require('../utils/format');
const { cancelKeyboard } = require('../utils/keyboard');

const addTenantWizard = new Scenes.WizardScene(
  'add_tenant_wizard',

  (ctx) => {
    ctx.reply('Kiracının adını girin:', cancelKeyboard());
    return ctx.wizard.next();
  },

  (ctx) => {
    if (!ctx.message?.text) return ctx.reply('Lütfen bir isim girin.');
    ctx.wizard.state.name = ctx.message.text.trim();
    ctx.reply('Mülk adresini girin:', cancelKeyboard());
    return ctx.wizard.next();
  },

  (ctx) => {
    if (!ctx.message?.text) return ctx.reply('Lütfen bir adres girin.');
    ctx.wizard.state.address = ctx.message.text.trim();
    ctx.reply('Aylık kira tutarını girin (sayı):', cancelKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.message?.text) return ctx.reply('Lütfen bir sayı girin.');
    const amount = parseFloat(ctx.message.text.trim());
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Geçersiz tutar. Pozitif bir sayı girin:');
    }

    const tenant = await Tenant.create({
      name: ctx.wizard.state.name,
      address: ctx.wizard.state.address,
      rentAmount: amount,
    });

    await ctx.reply(
      `Kiracı eklendi:\n` +
      `  Ad: ${tenant.name}\n` +
      `  Adres: ${tenant.address}\n` +
      `  Kira: ${formatCurrency(tenant.rentAmount)}`
    );
    return ctx.scene.leave();
  }
);

addTenantWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('İptal edildi.');
  return ctx.scene.leave();
});

module.exports = addTenantWizard;
