const { Markup } = require('telegraf');
const { formatCurrency, currentMonth } = require('../utils/format');
const { MONTH_LONG, backRow, cb, chunk, homeRow, monthButtons, render, yearRow } = require('../utils/menu');
const { loadYearGrid, togglePeriod } = require('../services/payments');

/* Panelin 12 kutucuklu ödeme tablosunun bot karşılığı. Aynı servis
   çağrılır: burada işaretlenen ay panelde de işaretli görünür. */

const MARK = {
  paid: '✅',
  partial: '🟡',
  overdue: '🔴',
  upcoming: '⬜',
  pending: '⬜',
  future: '⬜',
  outside: '⚫',
};

const LEGEND = '✅ ödendi · 🟡 eksik · 🔴 gecikti · ⬜ bekliyor · ⚫ kiracı değil';

function strip(row) {
  return row.months.map((cell) => MARK[cell.status] || '⬜').join('');
}

function overviewText(grid) {
  const lines = ['🧾 Ödeme tablosu · ' + grid.year, ''];

  if (!grid.rows.length) {
    lines.push('Kayıtlı kiracı yok. Önce bir kiracı ekleyin.');
    return lines.join('\n');
  }

  lines.push('Oca ▸ Ara');
  for (const row of grid.rows) {
    lines.push('');
    lines.push(row.name);
    lines.push(strip(row));
    lines.push(
      row.paidMonths + '/12 ödendi · ' + formatCurrency(row.received) +
      (row.outstanding ? ' · açık ' + formatCurrency(row.outstanding) : '')
    );
  }

  lines.push('');
  lines.push('Toplam: ' + formatCurrency(grid.totals.received) + ' / ' + formatCurrency(grid.totals.expected) +
    ' (%' + grid.totals.rate + ')');
  lines.push('');
  lines.push(LEGEND);
  lines.push('Bir kiracıya dokunun, ayları tek tek işaretleyin.');
  return lines.join('\n');
}

function overviewKeyboard(grid) {
  const tenantButtons = grid.rows.map((row) =>
    cb(row.paidMonths + '/12 · ' + row.name, 'grid:t:' + grid.year + ':' + row.tenantId)
  );

  return Markup.inlineKeyboard([
    ...chunk(tenantButtons, 1),
    yearRow('grid:y:', grid.year),
    homeRow(),
  ]);
}

function tenantText(grid, row) {
  const cells = row.months;
  const paidList = cells.filter((cell) => cell.status === 'paid').map((cell) => cell.label);
  const openList = cells.filter((cell) => cell.status === 'overdue' || cell.status === 'partial');

  const lines = [
    '🧾 ' + row.name + ' · ' + grid.year,
    row.address,
    '',
    'Kira: ' + formatCurrency(row.rentAmount) + ' · her ayın ' + row.paymentDay + '. günü',
    'Tahsil edilen: ' + formatCurrency(row.received) + ' / ' + formatCurrency(row.expected) + ' (%' + row.rate + ')',
    'İşaretli ay: ' + (paidList.length ? paidList.join(', ') : 'yok'),
  ];

  if (openList.length) {
    lines.push('');
    lines.push('Bekleyen');
    for (const cell of openList) {
      lines.push('• ' + MONTH_LONG[cell.month - 1] + ' · ' + formatCurrency(cell.remaining) +
        (cell.status === 'partial' ? ' eksik' : ' gecikti (' + cell.daysOverdue + ' gün)'));
    }
  }

  lines.push('');
  lines.push('Aya dokununca kira ödendi olarak işaretlenir, tekrar dokununca kalkar.');
  lines.push(LEGEND);
  return lines.join('\n');
}

function tenantKeyboard(grid, row) {
  const marks = {};
  for (const cell of row.months) marks[cell.month] = MARK[cell.status] || '⬜';

  return Markup.inlineKeyboard([
    ...monthButtons('grid:x:' + grid.year + ':' + row.tenantId + ':', { marks, columns: 3 }),
    yearRow('grid:t2:' + row.tenantId + ':', grid.year),
    backRow('grid:y:' + grid.year, '◀︎ Kiracılar'),
  ]);
}

module.exports = function registerGridCommands(bot) {
  async function showOverview(ctx, year) {
    const grid = await loadYearGrid(year);
    return render(ctx, overviewText(grid), overviewKeyboard(grid));
  }

  async function showTenant(ctx, year, tenantId) {
    const grid = await loadYearGrid(year);
    const row = grid.rows.find((item) => item.tenantId === tenantId);
    if (!row) return render(ctx, 'Kiracı bulunamadı ya da arşivde.', Markup.inlineKeyboard([homeRow()]));
    return render(ctx, tenantText(grid, row), tenantKeyboard(grid, row));
  }

  bot.command('odemetablosu', async (ctx) => {
    try {
      await showOverview(ctx, currentMonth().year);
    } catch (error) {
      console.error('Ödeme tablosu error:', error);
      await ctx.reply('Ödeme tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action('nav:grid', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showOverview(ctx, currentMonth().year);
    } catch (error) {
      console.error('nav:grid error:', error);
      await ctx.reply('Ödeme tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^grid:y:(\d{4})$/, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showOverview(ctx, Number(ctx.match[1]));
    } catch (error) {
      console.error('grid:y error:', error);
      await ctx.reply('Ödeme tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^grid:t:(\d{4}):([a-f\d]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showTenant(ctx, Number(ctx.match[1]), ctx.match[2]);
    } catch (error) {
      console.error('grid:t error:', error);
      await ctx.reply('Kiracı tablosu yüklenemedi: ' + error.message);
    }
  });

  // Kiracı görünümünde yıl değiştirme: kimlik önde, yıl arkada.
  bot.action(/^grid:t2:([a-f\d]{24}):(\d{4})$/i, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      await showTenant(ctx, Number(ctx.match[2]), ctx.match[1]);
    } catch (error) {
      console.error('grid:t2 error:', error);
      await ctx.reply('Kiracı tablosu yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^grid:x:(\d{4}):([a-f\d]{24}):(\d{1,2})$/i, async (ctx) => {
    const year = Number(ctx.match[1]);
    const tenantId = ctx.match[2];
    const month = Number(ctx.match[3]);

    try {
      const result = await togglePeriod({ tenantId, month, year, source: 'telegram' });
      const name = MONTH_LONG[month - 1];

      if (result.action === 'marked' && result.skipped) {
        await ctx.answerCbQuery(name + ' zaten ödenmiş.');
      } else if (result.action === 'marked') {
        await ctx.answerCbQuery('✅ ' + name + ' · ' + formatCurrency(result.payment.amount) + ' işaretlendi');
      } else if (result.removed) {
        await ctx.answerCbQuery('↩️ ' + name + ' işareti kaldırıldı');
      } else {
        await ctx.answerCbQuery(name + ' için kayıt yok.');
      }

      await showTenant(ctx, year, tenantId);
    } catch (error) {
      console.error('grid:x error:', error);
      await ctx.answerCbQuery('İşlem başarısız: ' + error.message, { show_alert: true });
    }
  });
};
