const { Markup } = require('telegraf');
const Notification = require('../models/notification');
const { runDailyReminder, runDueReminders } = require('../services/notificationService');
const { cb, homeRow, render } = require('../utils/menu');

const TYPE_LABEL = {
  due_soon: '⏰',
  due_soon_fee: '🏢',
  due_missing_fee: '🚨',
  due_settled: '🏢',
  due_reopened: '↩️',
  payment_missing: '🚨',
  payment_short: '⚠️',
  payment_recorded: '🧾',
  period_cleared: '↩️',
  daily_digest: '🔔',
  monthly_digest: '🗓',
};

function keyboard() {
  return Markup.inlineKeyboard([
    [cb('🔄 Kontrolü şimdi çalıştır', 'nt:run')],
    [cb('🧾 Ödeme tablosu', 'nav:grid'), cb('📊 Bu ay', 'nav:status')],
    homeRow(),
  ]);
}

module.exports = function registerNotificationCommands(bot) {
  async function listText() {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(12).lean();
    if (!notifications.length) return '🔔 Bildirimler\n\nHenüz bildirim kaydı yok.';

    const lines = ['🔔 Son bildirimler', ''];
    notifications.forEach((item) => {
      const state = item.status === 'sent' ? '✅' : item.status === 'failed' ? '⚠️' : '⏳';
      const kind = TYPE_LABEL[item.type] || '•';
      const date = item.createdAt ? new Date(item.createdAt).toLocaleString('tr-TR') : '';
      lines.push(state + ' ' + kind + ' ' + item.title);
      lines.push('   ' + date + (item.status === 'failed' && item.error ? ' · ' + item.error : ''));
    });

    lines.push('');
    lines.push('Kira ve aidat için ödeme gününden 1 gün önce, vadeden 3 gün sonra uyarı gelir.');
    return lines.join('\n');
  }

  async function show(ctx) {
    return render(ctx, await listText(), keyboard());
  }

  bot.command('bildirimler', show);

  bot.action('nav:notifications', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await show(ctx);
    } catch (error) {
      console.error('nav:notifications error:', error);
      await ctx.reply('Bildirimler yüklenemedi: ' + error.message);
    }
  });

  bot.action('menu_bildirimler', async (ctx) => {
    await ctx.answerCbQuery();
    return show(ctx);
  });

  async function runChecks(ctx) {
    const due = await runDueReminders();
    const daily = await runDailyReminder();
    const sentCount = (due.soon?.length || 0) + (due.late?.length || 0) + (due.dues?.length || 0);

    const lines = ['🔄 Kontrol çalıştırıldı', ''];
    if (due.soon?.length) lines.push('Yaklaşan uyarısı: ' + due.soon.join(', '));
    if (due.late?.length) lines.push('Gecikme uyarısı: ' + due.late.join(', '));
    if (due.dues?.length) lines.push('Aidat uyarısı: ' + due.dues.join(', '));
    if (!sentCount) lines.push('Yeni kiracı uyarısı yok.');
    lines.push(daily.sent ? 'Günlük özet gönderildi.' : 'Günlük özet gönderilmedi (' + (daily.reason || 'sebep yok') + ').');

    return ctx.reply(lines.join('\n'), keyboard());
  }

  bot.command('hatirlatma', async (ctx) => {
    try {
      await runChecks(ctx);
    } catch (error) {
      console.error('Hatırlatma command error:', error);
      await ctx.reply('Hatırlatma çalıştırılamadı: ' + error.message);
    }
  });

  bot.action('nt:run', async (ctx) => {
    await ctx.answerCbQuery('Çalıştırılıyor…');
    try {
      await runChecks(ctx);
    } catch (error) {
      console.error('nt:run error:', error);
      await ctx.reply('Hatırlatma çalıştırılamadı: ' + error.message);
    }
  });
};
