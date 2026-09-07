const { Markup } = require('telegraf');
const { formatCurrency, currentMonth } = require('../utils/format');
const { MONTH_LONG, backRow, cb, chunk, homeRow, monthButtons, render, yearRange } = require('../utils/menu');
const { annualReport, monthReport, rangeReport } = require('../services/reportData');
const {
  buildAnnualReportPdf,
  buildMonthReportPdf,
  buildRangeReportPdf,
  fileNameFor,
  pdfToBuffer,
} = require('../utils/pdfReport');

/* Rapor merkezi. Panelde indirilen PDF'in aynısı burada dosya olarak gelir:
   sene sene, ay ay ya da bir senenin tek ayı. */

function menuText() {
  return [
    '📄 Rapor merkezi',
    '',
    'Hangi raporu istiyorsunuz? Hepsi PDF olarak buraya gelir.',
    '',
    '• Aylık — tek bir ayın defteri: kim ödedi, kim kaldı, ne harcandı',
    '• Yıllık — kiracı × ay tablosu ve yılın seyri',
    '• Son aylar — kayan dönem karşılaştırması',
  ].join('\n');
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [cb('📆 Aylık rapor', 'rep:pick:month')],
    [cb('📅 Yıllık rapor', 'rep:pick:year')],
    [cb('📈 Son 6 ay', 'rep:range:6'), cb('📈 Son 12 ay', 'rep:range:12'), cb('📈 24 ay', 'rep:range:24')],
    homeRow(),
  ]);
}

function yearPickKeyboard(prefix) {
  return Markup.inlineKeyboard([
    ...chunk(yearRange().map((year) => cb(String(year), prefix + year)), 3),
    backRow('nav:reports'),
  ]);
}

async function sendPdf(ctx, doc, filename, caption, keyboard) {
  await ctx.replyWithChatAction('upload_document');
  const buffer = await pdfToBuffer(doc);
  await ctx.replyWithDocument(
    { source: buffer, filename },
    { caption, ...(keyboard || Markup.inlineKeyboard([homeRow()])) }
  );
}

module.exports = function registerReportCommands(bot) {
  async function showMenu(ctx) {
    return render(ctx, menuText(), menuKeyboard());
  }

  bot.command('raporlar', showMenu);

  bot.action('nav:reports', async (ctx) => {
    await ctx.answerCbQuery();
    await showMenu(ctx);
  });

  bot.action('rep:pick:month', async (ctx) => {
    await ctx.answerCbQuery();
    await render(ctx, '📆 Aylık rapor\n\nHangi yılın ayını istiyorsunuz?', yearPickKeyboard('rep:my:'));
  });

  bot.action('rep:pick:year', async (ctx) => {
    await ctx.answerCbQuery();
    await render(ctx, '📅 Yıllık rapor\n\nHangi yıl?', yearPickKeyboard('rep:y:'));
  });

  bot.action(/^rep:my:(\d{4})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const year = Number(ctx.match[1]);
    await render(
      ctx,
      '📆 ' + year + '\n\nHangi ay?',
      Markup.inlineKeyboard([
        ...monthButtons('rep:m:' + year + ':', { columns: 3 }),
        backRow('rep:pick:month'),
      ])
    );
  });

  bot.action(/^rep:m:(\d{4}):(\d{1,2})$/, async (ctx) => {
    const year = Number(ctx.match[1]);
    const month = Number(ctx.match[2]);
    if (month < 1 || month > 12) return ctx.answerCbQuery('Geçersiz ay.');

    await ctx.answerCbQuery('Rapor hazırlanıyor…');
    try {
      const report = await monthReport(month, year);
      const caption = [
        '📆 ' + report.label,
        'Tahsilat: ' + formatCurrency(report.totals.received) + ' / ' + formatCurrency(report.totals.expected) +
          ' (%' + report.totals.rate + ')',
        'Gider: ' + formatCurrency(report.totals.expense) + ' · Net: ' + formatCurrency(report.totals.net),
        report.totals.overdueCount || report.totals.partialCount
          ? report.totals.overdueCount + ' geciken · ' + report.totals.partialCount + ' eksik'
          : 'Tüm kiracılar ödedi.',
      ].join('\n');

      await sendPdf(
        ctx,
        buildMonthReportPdf(report),
        fileNameFor('month', year, month),
        caption,
        Markup.inlineKeyboard([
          [cb('◀︎ Başka ay', 'rep:my:' + year), cb('📄 Rapor menüsü', 'nav:reports')],
          homeRow(),
        ])
      );
    } catch (error) {
      console.error('Aylık rapor error:', error);
      await ctx.reply('Rapor hazırlanamadı: ' + error.message);
    }
  });

  bot.action(/^rep:y:(\d{4})$/, async (ctx) => {
    const year = Number(ctx.match[1]);
    await ctx.answerCbQuery('Rapor hazırlanıyor…');
    try {
      const annual = await annualReport(year);
      const caption = [
        '📅 ' + year + ' yıllık raporu',
        'Tahsilat: ' + formatCurrency(annual.totals.received) + ' / ' + formatCurrency(annual.totals.expected) +
          ' (%' + annual.totals.rate + ')',
        'Gider: ' + formatCurrency(annual.totals.expense) + ' · Net: ' + formatCurrency(annual.totals.net),
        annual.totals.tenantCount + ' kiracı tabloda',
      ].join('\n');

      await sendPdf(
        ctx,
        buildAnnualReportPdf(annual),
        fileNameFor('annual', year),
        caption,
        Markup.inlineKeyboard([
          [cb('◀︎ Başka yıl', 'rep:pick:year'), cb('📄 Rapor menüsü', 'nav:reports')],
          homeRow(),
        ])
      );
    } catch (error) {
      console.error('Yıllık rapor error:', error);
      await ctx.reply('Rapor hazırlanamadı: ' + error.message);
    }
  });

  bot.action(/^rep:range:(\d{1,2})$/, async (ctx) => {
    const months = Number(ctx.match[1]);
    if (months < 3 || months > 24) return ctx.answerCbQuery('Geçersiz aralık.');

    await ctx.answerCbQuery('Rapor hazırlanıyor…');
    try {
      const report = await rangeReport(months);
      const caption = [
        '📈 Son ' + months + ' ay',
        'Tahsilat: ' + formatCurrency(report.totals.received) + ' (%' + report.totals.rate + ')',
        'Gider: ' + formatCurrency(report.totals.expense) + ' · Net: ' + formatCurrency(report.totals.net),
        report.totals.bestMonth
          ? 'En iyi ay: ' + report.totals.bestMonth.label + ' · ' + formatCurrency(report.totals.bestMonth.received)
          : '',
      ].filter(Boolean).join('\n');

      await sendPdf(
        ctx,
        buildRangeReportPdf(report),
        fileNameFor('range', months),
        caption,
        Markup.inlineKeyboard([[cb('📄 Rapor menüsü', 'nav:reports')], homeRow()])
      );
    } catch (error) {
      console.error('Dönem raporu error:', error);
      await ctx.reply('Rapor hazırlanamadı: ' + error.message);
    }
  });

  // Kısayol: "bu ayın raporu" tek dokunuşla
  bot.action('rep:current', async (ctx) => {
    const { month, year } = currentMonth();
    await ctx.answerCbQuery('Rapor hazırlanıyor…');
    try {
      const report = await monthReport(month, year);
      await sendPdf(
        ctx,
        buildMonthReportPdf(report),
        fileNameFor('month', year, month),
        '📆 ' + MONTH_LONG[month - 1] + ' ' + year + ' raporu'
      );
    } catch (error) {
      console.error('Güncel rapor error:', error);
      await ctx.reply('Rapor hazırlanamadı: ' + error.message);
    }
  });
};
