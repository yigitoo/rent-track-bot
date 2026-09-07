const { Markup } = require('telegraf');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, currentMonth } = require('../utils/format');
const { confirmKeyboard } = require('../utils/keyboard');
const { backRow, cb, chunk, homeRow, render } = require('../utils/menu');
const { notifyTenantArchived } = require('../services/notificationService');
const { periodSummary } = require('../services/payments');

function listText(tenants) {
  if (!tenants.length) return '👥 Kiracılar\n\nHenüz kiracı yok. "Kiracı ekle" ile başlayın.';

  const total = tenants.reduce((sum, tenant) => sum + tenant.rentAmount, 0);
  const lines = ['👥 Kiracılar · ' + tenants.length + ' kayıt', 'Aylık toplam: ' + formatCurrency(total), ''];

  tenants.forEach((tenant, index) => {
    lines.push((index + 1) + '. ' + tenant.name);
    lines.push('   ' + tenant.address);
    lines.push('   ' + formatCurrency(tenant.rentAmount) + ' · her ayın ' + (tenant.paymentDay || 1) + '. günü');
  });

  lines.push('');
  lines.push('Detay için bir kiracıya dokunun.');
  return lines.join('\n');
}

function listKeyboard(tenants) {
  return Markup.inlineKeyboard([
    ...chunk(tenants.map((tenant) => cb(tenant.name, 'ten:v:' + tenant._id)), 2),
    [cb('➕ Kiracı ekle', 'menu_kiraciekle'), cb('✏️ Düzenle', 'menu_kiraciduzenle')],
    homeRow(),
  ]);
}

async function detailText(tenant) {
  const { month, year } = currentMonth();
  const summary = await periodSummary(tenant, month, year);
  const recent = await Payment.find({ tenant: tenant._id }).sort({ date: -1 }).limit(3);

  const lines = [
    '👤 ' + tenant.name,
    tenant.address,
    '',
    'Kira: ' + formatCurrency(tenant.rentAmount),
    'Ödeme günü: her ayın ' + (tenant.paymentDay || 1) + '. günü',
  ];

  if (tenant.phone) lines.push('Telefon: ' + tenant.phone);
  if (tenant.email) lines.push('E-posta: ' + tenant.email);
  if (tenant.deposit) lines.push('Depozito: ' + formatCurrency(tenant.deposit));
  if (tenant.increaseRate) lines.push('Artış oranı: %' + tenant.increaseRate);
  if (tenant.contractStart) lines.push('Sözleşme başlangıcı: ' + formatDate(tenant.contractStart));
  if (tenant.contractEnd) lines.push('Sözleşme bitişi: ' + formatDate(tenant.contractEnd));

  lines.push('');
  lines.push('Bu ay (' + month + '/' + year + '): ' +
    (summary.paid
      ? '✅ ödendi · ' + formatCurrency(summary.totalPaid)
      : summary.totalPaid > 0
        ? '🟡 eksik · ' + formatCurrency(summary.totalPaid) + ' / ' + formatCurrency(summary.expected)
        : '⬜ bekliyor · ' + formatCurrency(summary.remaining)));

  if (recent.length) {
    lines.push('');
    lines.push('Son ödemeler');
    recent.forEach((payment) => {
      lines.push('• ' + formatDate(payment.date) + ' · ' + formatCurrency(payment.amount) +
        ' · ' + payment.month + '/' + payment.year);
    });
  }

  if (tenant.notes) {
    lines.push('');
    lines.push('Not: ' + tenant.notes);
  }

  return lines.join('\n');
}

function detailKeyboard(tenant) {
  const year = currentMonth().year;
  return Markup.inlineKeyboard([
    [cb('🧾 Ödeme tablosu', 'grid:t:' + year + ':' + tenant._id)],
    [cb('📜 Ödeme geçmişi', 'hist_t:' + tenant._id), cb('⏳ Kira ertele', 'menu_kiraertele')],
    [cb('✏️ Düzenle', 'menu_kiraciduzenle'), cb('🗂 Arşivle', 'ten:rm:' + tenant._id)],
    backRow('nav:tenants', '◀︎ Kiracılar'),
  ]);
}

module.exports = function registerTenantCommands(bot) {
  async function showList(ctx) {
    const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
    return render(ctx, listText(tenants), listKeyboard(tenants));
  }

  bot.command('kiracilar', showList);
  bot.command('kiraciekle', (ctx) => ctx.scene.enter('add_tenant_wizard'));
  bot.command('kiraciduzenle', (ctx) => ctx.scene.enter('edit_tenant_wizard'));
  bot.command('kiracisil', showList);

  bot.action('nav:tenants', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showList(ctx);
    } catch (error) {
      console.error('nav:tenants error:', error);
      await ctx.reply('Kiracılar yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^ten:v:([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const tenant = await Tenant.findById(ctx.match[1]);
      if (!tenant) return render(ctx, 'Kiracı bulunamadı.', Markup.inlineKeyboard([backRow('nav:tenants')]));
      await render(ctx, await detailText(tenant), detailKeyboard(tenant));
    } catch (error) {
      console.error('ten:v error:', error);
      await ctx.reply('Kiracı açılamadı: ' + error.message);
    }
  });

  bot.action(/^ten:rm:([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    const tenant = await Tenant.findById(ctx.match[1]);
    if (!tenant) return ctx.reply('Kiracı bulunamadı.');
    ctx.session.removeTenantId = tenant._id.toString();
    await ctx.reply(
      '"' + tenant.name + '" arşivlensin mi?\nÖdeme geçmişi korunur.',
      confirmKeyboard('rm_confirm', 'rm_cancel')
    );
  });

  bot.action('rm_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    const id = ctx.session.removeTenantId;
    if (!id) return ctx.reply('Kiracı seçilmedi.');
    const tenant = await Tenant.findByIdAndUpdate(id, { isActive: false }, { new: true });
    delete ctx.session.removeTenantId;
    if (tenant) await notifyTenantArchived(tenant);
    await ctx.reply('Kiracı arşivlendi.', Markup.inlineKeyboard([backRow('nav:tenants')]));
  });

  bot.action('rm_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.removeTenantId;
    await ctx.reply('İptal edildi.', Markup.inlineKeyboard([homeRow()]));
  });
};
