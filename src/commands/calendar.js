const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { currentMonth } = require('../utils/format');
const { buildPaymentsByTenant, getMonthlyStatuses } = require('../utils/rentSchedule');
const { buildTelegramCalendar, calendarKeyboard } = require('../utils/telegramCalendar');

dayjs.extend(customParseFormat);

function parsePeriod(input) {
  const value = String(input || '').trim();
  if (!value) return currentMonth();
  const parsed = dayjs(value, ['MM/YYYY', 'M/YYYY'], true);
  if (!parsed.isValid()) return null;
  return { month: parsed.month() + 1, year: parsed.year() };
}

async function calendarPayload(month, year) {
  const tenants = await Tenant.find({ isActive: true }).sort({ name: 1 });
  const payments = await Payment.find({ month, year });
  const statuses = getMonthlyStatuses(tenants, buildPaymentsByTenant(payments), month, year);
  return { tenants, statuses };
}

module.exports = function registerCalendarCommands(bot) {
  async function render(ctx, month, year, edit = false) {
    const payload = await calendarPayload(month, year);
    if (!payload.tenants.length) {
      return edit ? ctx.editMessageText('Kiracı bulunamadı.') : ctx.reply('Kiracı bulunamadı.');
    }

    const text = buildTelegramCalendar({ month, year, statuses: payload.statuses });
    const keyboard = calendarKeyboard(month, year);
    return edit ? ctx.editMessageText(text, keyboard) : ctx.reply(text, keyboard);
  }

  bot.command('takvim', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1).join(' ');
    const period = parsePeriod(args);
    if (!period) return ctx.reply('Geçersiz format. Kullanım: /takvim AA/YYYY');
    try {
      await render(ctx, period.month, period.year);
    } catch (error) {
      console.error('Takvim error:', error);
      await ctx.reply('Takvim yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^cal:(\d{4}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const year = Number(ctx.match[1]);
    const month = Number(ctx.match[2]);
    if (month < 1 || month > 12) return;
    try {
      await render(ctx, month, year, true);
    } catch (error) {
      console.error('Takvim action error:', error);
      await ctx.reply('Takvim yüklenemedi: ' + error.message);
    }
  });

  bot.action('menu_takvim', async (ctx) => {
    await ctx.answerCbQuery();
    const { month, year } = currentMonth();
    await render(ctx, month, year);
  });
};
