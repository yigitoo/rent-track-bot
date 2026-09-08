const { Markup } = require('telegraf');
const { formatCurrency, formatDate, currentMonth } = require('../utils/format');
const { MONTH_LONG, backRow, cb, chunk, homeRow, monthButtons, render, yearRow } = require('../utils/menu');
const { loadYearGrid, toggleDue } = require('../services/dues');

/* Aidat takibinin bot yüzü. Panelde işaretlenen ay burada da işaretlidir:
   ikisi de aynı gider kaydını yazar. */

const MARK = {
  paid: '✅',
  overdue: '🔴',
  upcoming: '⬜',
  future: '⬜',
  outside: '⚫',
};

const LEGEND = '✅ ödendi · 🔴 gecikti · ⬜ sırada · ⚫ kapsam dışı';

function overviewText(grid) {
  const lines = ['🏢 Aidat takibi · ' + grid.year, ''];

  if (!grid.rows.length) {
    lines.push('Kayıtlı aidat kalemi yok.');
    lines.push('Web panelinden Aidat sayfasına bir kalem ekleyin.');
    return lines.join('\n');
  }

  lines.push('Oca ▸ Ara');
  for (const row of grid.rows) {
    lines.push('');
    lines.push(row.label + (row.unit ? ' · ' + row.title : '') + (row.tenantName ? ' · ' + row.tenantName : '') + (row.isActive ? '' : ' (duraklatıldı)'));
    lines.push(row.months.map((cell) => MARK[cell.status] || '⬜').join(''));
    lines.push(
      row.paidMonths + '/12 ödendi · ' + formatCurrency(row.settled) +
      (row.outstanding ? ' · açık ' + formatCurrency(row.outstanding) : '')
    );
  }

  lines.push('');
  lines.push('Toplam: ' + formatCurrency(grid.totals.settled) + ' / ' + formatCurrency(grid.totals.expected) +
    ' (%' + grid.totals.rate + ')');
  lines.push('');
  lines.push(LEGEND);
  lines.push('Bir kaleme dokunun, ayları tek tek işaretleyin.');
  return lines.join('\n');
}

function overviewKeyboard(grid) {
  return Markup.inlineKeyboard([
    ...chunk(
      grid.rows.map((row) => cb(row.paidMonths + '/12 · ' + row.label, 'due:i:' + grid.year + ':' + row.dueId)),
      1
    ),
    yearRow('due:y:', grid.year),
    homeRow(),
  ]);
}

function itemText(grid, row) {
  const paidList = row.months.filter((cell) => cell.paid).map((cell) => cell.label);
  const late = row.months.filter((cell) => cell.status === 'overdue');

  const lines = [
    '🏢 ' + row.label + ' · ' + grid.year,
    (row.unit ? row.title + ' · ' : '') + (row.tenantName ? 'İlgili kiracı: ' + row.tenantName : 'Genel gider'),
    '',
    'Tutar: ' + formatCurrency(row.amount) + ' · her ayın ' + row.dayOfMonth + '. günü',
    'Ödenen: ' + formatCurrency(row.settled) + ' / ' + formatCurrency(row.expected) + ' (%' + row.rate + ')',
    'İşaretli ay: ' + (paidList.length ? paidList.join(', ') : 'yok'),
  ];

  if (late.length) {
    lines.push('');
    lines.push('Geciken');
    for (const cell of late) {
      lines.push('• ' + MONTH_LONG[cell.month - 1] + ' · ' + formatCurrency(cell.amount) +
        ' · ' + cell.daysOverdue + ' gün (' + formatDate(cell.dueDate) + ')');
    }
  }

  lines.push('');
  lines.push('Aya dokununca aidat ödendi olarak işaretlenir ve gider kaydı oluşur.');
  lines.push(LEGEND);
  return lines.join('\n');
}

function itemKeyboard(grid, row) {
  const marks = {};
  for (const cell of row.months) marks[cell.month] = MARK[cell.status] || '⬜';

  return Markup.inlineKeyboard([
    ...monthButtons('due:x:' + grid.year + ':' + row.dueId + ':', { marks, columns: 3 }),
    yearRow('due:i2:' + row.dueId + ':', grid.year),
    backRow('due:y:' + grid.year, '◀︎ Aidat kalemleri'),
  ]);
}

module.exports = function registerDuesCommands(bot) {
  async function showOverview(ctx, year) {
    const grid = await loadYearGrid(year);
    return render(ctx, overviewText(grid), overviewKeyboard(grid));
  }

  async function showItem(ctx, year, dueId) {
    const grid = await loadYearGrid(year);
    const row = grid.rows.find((item) => item.dueId === dueId);
    if (!row) return render(ctx, 'Aidat kalemi bulunamadı.', Markup.inlineKeyboard([homeRow()]));
    return render(ctx, itemText(grid, row), itemKeyboard(grid, row));
  }

  bot.command('aidat', async (ctx) => {
    try {
      await showOverview(ctx, currentMonth().year);
    } catch (error) {
      console.error('Aidat error:', error);
      await ctx.reply('Aidat tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action('nav:dues', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showOverview(ctx, currentMonth().year);
    } catch (error) {
      console.error('nav:dues error:', error);
      await ctx.reply('Aidat tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^due:y:(\d{4})$/, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showOverview(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error('due:y error:', error);
      await ctx.reply('Aidat tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^due:i:(\d{4}):([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showItem(ctx, Number(ctx.match[1]), ctx.match[2]);
    } catch (error) {
      console.error('due:i error:', error);
      await ctx.reply('Aidat kalemi açılamadı: ' + error.message);
    }
  });

  bot.action(/^due:i2:([a-f\d]{24}):(\d{4})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showItem(ctx, Number(ctx.match[2]), ctx.match[1]);
    } catch (error) {
      console.error('due:i2 error:', error);
      await ctx.reply('Aidat kalemi açılamadı: ' + error.message);
    }
  });

  bot.action(/^due:x:(\d{4}):([a-f\d]{24}):(\d{1,2})$/i, async (ctx) => {
    const year = Number(ctx.match[1]);
    const dueId = ctx.match[2];
    const month = Number(ctx.match[3]);

    try {
      const result = await toggleDue({ dueId, month, year, source: 'telegram' });
      const name = MONTH_LONG[month - 1];

      if (result.action === 'marked' && result.skipped) {
        await ctx.answerCbQuery(name + ' zaten ödenmiş.');
      } else if (result.action === 'marked') {
        await ctx.answerCbQuery('✅ ' + name + ' · ' + formatCurrency(result.expense.amount) + ' ödendi');
      } else if (!result.skipped) {
        await ctx.answerCbQuery('↩️ ' + name + ' işareti kaldırıldı');
      } else {
        await ctx.answerCbQuery(name + ' zaten işaretli değil.');
      }

      await showItem(ctx, year, dueId);
    } catch (error) {
      console.error('due:x error:', error);
      await ctx.answerCbQuery('İşlem başarısız: ' + error.message, { show_alert: true });
    }
  });
};
