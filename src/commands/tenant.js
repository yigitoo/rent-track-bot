const Tenant = require('../models/tenant');
const { formatCurrency } = require('../utils/format');
const { tenantListKeyboard, confirmKeyboard } = require('../utils/keyboard');

module.exports = function registerTenantCommands(bot) {
  bot.command('kiraciekle', (ctx) => ctx.scene.enter('add_tenant_wizard'));

  bot.command('kiraciduzenle', (ctx) => ctx.scene.enter('edit_tenant_wizard'));

  bot.command('kiracilar', async (ctx) => {
    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
    if (!tenants.length) {
      return ctx.reply('Henüz kiracı yok. /kiraciekle ile ekleyin.');
    }

    const lines = tenants.map((t, i) =>
      `${i + 1}. ${t.name}\n   ${t.address}\n   Kira: ${formatCurrency(t.rentAmount)}`
    );
    await ctx.reply(lines.join('\n\n'));
  });

  bot.command('kiracisil', async (ctx) => {
    const tenants = await Tenant.find({ isActive: true });
    if (!tenants.length) {
      return ctx.reply('Kiracı bulunamadı.');
    }
    await ctx.reply('Silinecek kiracıyı seçin:', tenantListKeyboard(tenants, 'rm_t'));
  });

  bot.action(/^rm_t:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const tenant = await Tenant.findById(ctx.match[1]);
    if (!tenant) return ctx.reply('Kiracı bulunamadı.');
    ctx.session.removeTenantId = tenant._id.toString();
    await ctx.reply(
      `"${tenant.name}" silinsin mi?\nÖdeme geçmişi korunacaktır.`,
      confirmKeyboard('rm_confirm', 'rm_cancel')
    );
  });

  bot.action('rm_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const id = ctx.session.removeTenantId;
    if (!id) return ctx.reply('Kiracı seçilmedi.');
    await Tenant.findByIdAndUpdate(id, { isActive: false });
    delete ctx.session.removeTenantId;
    await ctx.reply('Kiracı silindi.');
  });

  bot.action('rm_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.removeTenantId;
    await ctx.reply('İptal edildi.');
  });
};
