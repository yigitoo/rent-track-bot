const { Markup } = require('telegraf');
const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const Expense = require('../models/expense');
const Recurrence = require('../models/recurrence');
const { formatCurrency, formatDate, formatMonthYear, currentMonth } = require('../utils/format');
const { categoryLabel } = require('../utils/categories');
const {
  buildAgenda,
  buildCategoryBreakdown,
  buildSeries,
  monthKeys,
} = require('../utils/reports');
const { cb, homeRow, render } = require('../utils/menu');

function parsePeriodArg(text, fallback) {
  const match = String(text || '').match(/(\d{1,2})[./-](\d{4})/);
  if (!match) return fallback;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return fallback;
  return { month, year };
}

/* Bir önceki / sonraki döneme dokunarak gezinmek için. */
function shiftPeriod(month, year, delta) {
  const date = new Date(year, month - 1 + delta, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

module.exports = function registerFinanceCommands(bot) {
  async function expensesView(month, year) {
    const expenses = await Expense.find({ month, year }).sort({ date: -1 }).populate('tenant', 'name');
    const total = expenses.reduce((sum, item) => sum + item.amount, 0);
    const lines = ['📉 Giderler · ' + formatMonthYear(month, year), ''];

    if (!expenses.length) {
      lines.push('Bu dönemde gider kaydı yok.');
    } else {
      expenses.forEach((item) => {
        lines.push('• ' + item.title + ' · ' + formatCurrency(item.amount));
        lines.push('  ' + categoryLabel(item.category) + ' · ' + formatDate(item.date) +
          (item.tenant?.name ? ' · ' + item.tenant.name : ''));
      });
      lines.push('');
      lines.push('Toplam: ' + formatCurrency(total));
    }

    const recurring = await Recurrence.find({ isActive: true }).sort({ dayOfMonth: 1 });
    if (recurring.length) {
      lines.push('', 'Düzenli kalemler');
      recurring.forEach((item) => {
        lines.push('• ' + item.title + ' · ' + formatCurrency(item.amount) + ' · her ayın ' + item.dayOfMonth + '. günü');
      });
    }

    const previous = shiftPeriod(month, year, -1);
    const next = shiftPeriod(month, year, 1);
    const keyboard = Markup.inlineKeyboard([
      [
        cb('◀︎ ' + formatMonthYear(previous.month, previous.year), 'exp:' + previous.year + ':' + previous.month),
        cb(formatMonthYear(next.month, next.year) + ' ▶︎', 'exp:' + next.year + ':' + next.month),
      ],
      [cb('📄 Rapor / PDF', 'nav:reports')],
      homeRow(),
    ]);

    return { text: lines.join('\n'), keyboard };
  }

  bot.command('giderler', async (ctx) => {
    try {
      const { month, year } = parsePeriodArg(ctx.message.text, currentMonth());
      const view = await expensesView(month, year);
      await ctx.reply(view.text, view.keyboard);
    } catch (error) {
      console.error('giderler error:', error);
      await ctx.reply('Gider listesi alınamadı: ' + error.message);
    }
  });

  bot.action('nav:expenses', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { month, year } = currentMonth();
      const view = await expensesView(month, year);
      await render(ctx, view.text, view.keyboard);
    } catch (error) {
      console.error('nav:expenses error:', error);
      await ctx.reply('Gider listesi alınamadı: ' + error.message);
    }
  });

  bot.action(/^exp:(\d{4}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const year = Number(ctx.match[1]);
    const month = Number(ctx.match[2]);
    if (month < 1 || month > 12) return undefined;
    try {
      const view = await expensesView(month, year);
      return render(ctx, view.text, view.keyboard);
    } catch (error) {
      console.error('exp nav error:', error);
      return ctx.reply('Gider listesi alınamadı: ' + error.message);
    }
  });

  bot.command('rapor', async (ctx) => {
    try {
      const requested = Number(String(ctx.message.text || '').replace(/\D/g, ''));
      const monthCount = requested >= 3 && requested <= 24 ? requested : 6;
      const months = monthKeys(monthCount);
      const first = months[0];
      const rangeStart = new Date(first.year, first.month - 1, 1);

      const [tenants, payments, expenses] = await Promise.all([
        Tenant.find({ isActive: true }).sort({ name: 1 }),
        Payment.find({ date: { $gte: rangeStart } }),
        Expense.find({ date: { $gte: rangeStart } }),
      ]);

      const series = buildSeries({ months, tenants, payments, expenses });
      const totals = series.reduce(
        (acc, item) => ({
          expected: acc.expected + item.expected,
          received: acc.received + item.received,
          expense: acc.expense + item.expense,
        }),
        { expected: 0, received: 0, expense: 0 }
      );
      const rate = totals.expected ? Math.round((totals.received / totals.expected) * 100) : 0;

      const lines = [
        '📊 Son ' + monthCount + ' ay',
        '',
        'Tahsilat: ' + formatCurrency(totals.received) + ' (%' + rate + ')',
        'Gider: ' + formatCurrency(totals.expense),
        'Net: ' + formatCurrency(totals.received - totals.expense),
        '',
        'Aylara göre',
        ...series.map((item) =>
          '• ' + item.short + ' ' + item.year + ' · ' + formatCurrency(item.received) + ' · %' + item.rate
        ),
      ];

      const categories = buildCategoryBreakdown(expenses);
      if (categories.length) {
        lines.push('', 'Gider kırılımı');
        categories.slice(0, 5).forEach((item) => {
          lines.push('• ' + item.label + ': ' + formatCurrency(item.total));
        });
      }

      const agenda = buildAgenda(tenants);
      if (agenda.length) {
        lines.push('', 'Gündem');
        agenda.slice(0, 5).forEach((item) => {
          lines.push('• ' + item.name + ' · ' +
            (item.type === 'contract' ? 'sözleşme bitişi' : 'kira yıldönümü') +
            ' · ' + formatDate(item.date));
        });
      }

      await ctx.reply(lines.join('\n'), Markup.inlineKeyboard([[cb('📄 PDF olarak indir', 'rep:range:' + monthCount)], homeRow()]));
    } catch (error) {
      console.error('rapor error:', error);
      await ctx.reply('Rapor alınamadı: ' + error.message);
    }
  });
};
