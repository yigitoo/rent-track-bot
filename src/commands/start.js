const { Markup } = require('telegraf');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { tenantListKeyboard } = require('../utils/keyboard');
const { sendHtmlMail } = require('../utils/mailer');
const { buildReportHtml } = require('../utils/emailTemplate');

module.exports = function registerStartCommands(bot) {
  const welcomeText =
    '🏠 Kira Takip Botu\n\n' +
    'Kiracılarınızın kira ödemelerini takip edin.\n' +
    'Aşağıdaki butonları kullanabilir veya komut yazabilirsiniz.';

  const helpText =
    '📋 Komutlar ve Kullanım\n\n' +
    '👤 Kiracı İşlemleri:\n' +
    '  /kiraciekle - Yeni kiracı ekle\n' +
    '  /kiracilar - Kiracıları listele\n' +
    '  /kiraciduzenle - Kiracı bilgisi düzenle\n' +
    '  /kiracisil - Kiracıyı kaldır\n\n' +
    '💰 Ödeme İşlemleri:\n' +
    '  /odemeekle - Kira ödemesi kaydet\n' +
    '  /odemeler - Kiracı ödeme geçmişi\n\n' +
    '📊 Raporlar:\n' +
    '  /durum - Bu ayın ödeme durumu\n' +
    '  /ozet - Aylık özet (/ozet AA/YYYY)\n' +
    '  /mailgonder - Mail raporu (/mailgonder AA/YYYY)\n\n' +
    '💡 İpucu: AA/YYYY parametresi opsiyoneldir.\n' +
    'Girilmezse bulunduğunuz ay geçerli olur.';

  const mainMenu = Markup.inlineKeyboard([
    [
      Markup.button.callback('👤 Kiracı Ekle', 'menu_kiraciekle'),
      Markup.button.callback('📋 Kiracılar', 'menu_kiracilar'),
    ],
    [
      Markup.button.callback('💰 Ödeme Ekle', 'menu_odemeekle'),
      Markup.button.callback('📜 Ödemeler', 'menu_odemeler'),
    ],
    [
      Markup.button.callback('📊 Durum', 'menu_durum'),
      Markup.button.callback('📈 Özet', 'menu_ozet'),
    ],
    [
      Markup.button.callback('📧 Mail Gönder', 'menu_mailgonder'),
      Markup.button.callback('❓ Yardım', 'menu_yardim'),
    ],
  ]);

  bot.start((ctx) => ctx.reply(welcomeText, mainMenu));
  bot.command('yardim', (ctx) => ctx.reply(helpText, mainMenu));
  bot.help((ctx) => ctx.reply(helpText, mainMenu));

  bot.action('menu_kiraciekle', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('add_tenant_wizard');
  });

  bot.action('menu_kiracilar', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
      if (!tenants.length) return ctx.reply('Henüz kiracı yok. /kiraciekle ile ekleyin.');
      const lines = tenants.map((t, i) =>
        `${i + 1}. ${t.name}\n   ${t.address}\n   Kira: ${formatCurrency(t.rentAmount)}`
      );
      await ctx.reply(lines.join('\n\n'));
    } catch (err) {
      console.error('menu_kiracilar error:', err);
      await ctx.reply('Hata oluştu: ' + err.message);
    }
  });

  bot.action('menu_odemeekle', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('add_payment_wizard');
  });

  bot.action('menu_odemeler', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const tenants = await Tenant.find({ isActive: true });
      if (!tenants.length) return ctx.reply('Kiracı bulunamadı.');
      await ctx.reply('Geçmişini görmek istediğiniz kiracıyı seçin:', tenantListKeyboard(tenants, 'hist_t'));
    } catch (err) {
      console.error('menu_odemeler error:', err);
      await ctx.reply('Hata oluştu: ' + err.message);
    }
  });

  bot.action('menu_durum', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
      if (!tenants.length) return ctx.reply('Kiracı bulunamadı.');

      const payments = await Payment.find({ month, year });
      const paymentsByTenant = {};
      for (const p of payments) {
        const tid = p.tenant.toString();
        if (!paymentsByTenant[tid]) paymentsByTenant[tid] = [];
        paymentsByTenant[tid].push(p);
      }

      const paid = [];
      const unpaid = [];
      for (const tenant of tenants) {
        const tid = tenant._id.toString();
        const tp = paymentsByTenant[tid] || [];
        if (tp.length > 0) {
          const totalPaid = tp.reduce((sum, p) => sum + p.amount, 0);
          const lastDate = tp.sort((a, b) => b.date - a.date)[0].date;
          paid.push({ name: tenant.name, amount: totalPaid, expected: tenant.rentAmount, date: lastDate, partial: totalPaid < tenant.rentAmount });
        } else {
          unpaid.push({ name: tenant.name, amount: tenant.rentAmount });
        }
      }

      let text = `--- ${formatMonthYear(month, year)} Ödeme Durumu ---\n\n`;
      if (paid.length) {
        text += `Ödendi (${paid.length}/${tenants.length}):\n`;
        for (const p of paid) {
          const pt = p.partial ? ` ⚠️ ${formatCurrency(p.amount)}/${formatCurrency(p.expected)}` : '';
          text += `  ${p.name} - ${formatCurrency(p.amount)} (${formatDate(p.date)})${pt}\n`;
        }
      }
      if (unpaid.length) {
        text += `\nÖdenmedi (${unpaid.length}/${tenants.length}):\n`;
        for (const u of unpaid) text += `  ${u.name} - ${formatCurrency(u.amount)}\n`;
      }
      if (!unpaid.length) text += '\nTüm kiracılar ödedi!';
      await ctx.reply(text);
    } catch (err) {
      console.error('menu_durum error:', err);
      await ctx.reply('Hata oluştu: ' + err.message);
    }
  });

  bot.action('menu_ozet', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
      if (!tenants.length) return ctx.reply('Kiracı bulunamadı.');

      const payments = await Payment.find({ month, year });
      const pbt = {};
      for (const p of payments) {
        const t = p.tenant.toString();
        pbt[t] = (pbt[t] || 0) + p.amount;
      }
      const totalExpected = tenants.reduce((s, t) => s + t.rentAmount, 0);
      const totalReceived = Object.values(pbt).reduce((s, a) => s + a, 0);

      let text = `--- ${formatMonthYear(month, year)} Özet ---\n\n`;
      text += `Beklenen:  ${formatCurrency(totalExpected)} (${tenants.length} kiracı)\n`;
      text += `Alınan:    ${formatCurrency(totalReceived)}\n`;
      text += `Kalan:     ${formatCurrency(totalExpected - totalReceived)}\n\nDetay:\n`;
      for (const t of tenants) {
        const pa = pbt[t._id.toString()] || 0;
        const st = pa >= t.rentAmount ? 'ÖDENDİ' : pa > 0 ? `EKSİK (${formatCurrency(pa)}/${formatCurrency(t.rentAmount)})` : 'ÖDENMEDİ';
        text += `  ${t.name} - ${formatCurrency(t.rentAmount)} - ${st}\n`;
      }
      await ctx.reply(text);
    } catch (err) {
      console.error('menu_ozet error:', err);
      await ctx.reply('Hata oluştu: ' + err.message);
    }
  });

  bot.action('menu_mailgonder', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { month, year } = currentMonth();
      const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
      if (!tenants.length) return ctx.reply('Kiracı bulunamadı.');

      await ctx.reply('Mail hazırlanıyor...');
      const payments = await Payment.find({ month, year });
      const paymentsByTenant = {};
      for (const p of payments) {
        const t = p.tenant.toString();
        if (!paymentsByTenant[t]) paymentsByTenant[t] = [];
        paymentsByTenant[t].push(p);
      }
      const totalExpected = tenants.reduce((s, t) => s + t.rentAmount, 0);
      const totalReceived = payments.reduce((s, p) => s + p.amount, 0);

      const html = buildReportHtml({ month, year, tenants, paymentsByTenant, totalExpected, totalReceived });
      await sendHtmlMail(`Kira Raporu - ${formatMonthYear(month, year)}`, html);
      await ctx.reply(`Mail gönderildi: ${process.env.EMAIL_TO}`);
    } catch (err) {
      console.error('menu_mailgonder error:', err);
      await ctx.reply('Mail gönderilemedi: ' + err.message);
    }
  });

  bot.action('menu_yardim', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(helpText, mainMenu);
  });

  bot.telegram.setMyCommands([
    { command: 'kiraciekle', description: 'Yeni kiracı ekle' },
    { command: 'kiracilar', description: 'Kiracıları listele' },
    { command: 'kiraciduzenle', description: 'Kiracı düzenle' },
    { command: 'kiracisil', description: 'Kiracı sil' },
    { command: 'odemeekle', description: 'Kira ödemesi kaydet' },
    { command: 'odemeler', description: 'Ödeme geçmişi' },
    { command: 'durum', description: 'Bu ayın durumu' },
    { command: 'ozet', description: 'Aylık özet' },
    { command: 'mailgonder', description: 'Mail ile rapor gönder' },
    { command: 'yardim', description: 'Yardım ve kullanım' },
  ]);
};
