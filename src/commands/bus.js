const { Markup } = require('telegraf');
const { formatCurrency, formatDate, currentMonth } = require('../utils/format');
const { backRow, cb, chunk, homeRow, render } = require('../utils/menu');
const { listBuses, loadMonth, monthReport, saveDay } = require('../services/bus');
const { buildBusMonthReportPdf, fileNameFor, pdfToBuffer } = require('../utils/pdfReport');
const { parseMoney } = require('../utils/money');

/* Otobüs hattı defterinin bot yüzü. Kâğıda yazılan satır tek komutla
   girilebilsin diye: /gun 7 9050 2700 2000 300 */

const KULLANIM = [
  '🚌 Gün kaydı',
  '',
  'Kâğıttaki satırı tek mesajda yazın:',
  '',
  '/gun <araç no> <toplam> <mazot> <yövmiye> <denekçi>',
  '',
  'Örnek:',
  '/gun 7 9050 2700 2000 300',
  '',
  'Sonuna not ekleyebilirsiniz:',
  '/gun 7 9050 2700 2000 300 lastik değişti',
  '',
  'Belirli bir gün için tarihi başa yazın:',
  '/gun 08.09.2026 7 9050 2700 2000 300',
  '',
  'Kalan tutar kendiliğinden hesaplanır.',
].join('\n');

function ozetMetni(data) {
  const t = data.totals;
  const lines = [
    '🚌 Otobüs hattı · ' + data.label,
    '',
    'Toplam hasılat: ' + formatCurrency(t.gross),
    'Mazot: ' + formatCurrency(t.fuel),
    'Yövmiye: ' + formatCurrency(t.wage),
    'Denekçi: ' + formatCurrency(t.fee),
  ];
  if (t.other) lines.push('Diğer: ' + formatCurrency(t.other));
  lines.push('Kalan: ' + formatCurrency(t.net));
  lines.push('');
  lines.push(t.days + ' gün işlendi · günlük ortalama ' +
    formatCurrency(t.days ? Math.round(t.net / t.days) : 0) + ' kalan');

  const dolu = data.perBus.filter((bus) => bus.totals.days > 0);
  if (dolu.length) {
    lines.push('');
    lines.push('Araç bazında');
    dolu.forEach((bus) => {
      lines.push('• ' + bus.number + ' numara' + (bus.label ? ' · ' + bus.label : '') +
        ' · ' + bus.totals.days + ' gün · ' + formatCurrency(bus.totals.net));
    });
  }

  if (!t.days) {
    lines.push('');
    lines.push('Bu ay henüz kayıt yok. /gun ile ekleyebilirsiniz.');
  }
  return lines.join('\n');
}

function ozetKlavyesi(data) {
  const onceki = new Date(data.year, data.month - 2, 1);
  const sonraki = new Date(data.year, data.month, 1);
  return Markup.inlineKeyboard([
    [
      cb('← ' + onceki.toLocaleDateString('tr-TR', { month: 'long' }), 'bus:m:' + onceki.getFullYear() + ':' + (onceki.getMonth() + 1)),
      cb(sonraki.toLocaleDateString('tr-TR', { month: 'long' }) + ' →', 'bus:m:' + sonraki.getFullYear() + ':' + (sonraki.getMonth() + 1)),
    ],
    [cb('📄 Ay sonu raporu (PDF)', 'bus:pdf:' + data.year + ':' + data.month)],
    [cb('➕ Gün nasıl eklenir', 'bus:help')],
    homeRow(),
  ]);
}

/* "08.09.2026 7 9050 2700 2000 300 not" ya da "7 9050 2700 2000 300" */
function satiriCoz(metin) {
  const parcalar = String(metin || '').trim().split(/\s+/).filter(Boolean);
  if (!parcalar.length) return null;

  let gun = null;
  let ay = null;
  let yil = null;

  const tarih = parcalar[0].match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (tarih) {
    gun = Number(tarih[1]);
    ay = Number(tarih[2]);
    yil = Number(tarih[3]);
    parcalar.shift();
  }

  if (parcalar.length < 2) return null;
  const busNumber = parcalar.shift();

  const sayilar = [];
  while (parcalar.length && sayilar.length < 4) {
    const deger = parseMoney(parcalar[0]);
    if (!Number.isFinite(deger)) break;
    sayilar.push(deger);
    parcalar.shift();
  }
  if (!sayilar.length) return null;

  const bugun = new Date();
  return {
    busNumber,
    day: gun ?? bugun.getDate(),
    month: ay ?? bugun.getMonth() + 1,
    year: yil ?? bugun.getFullYear(),
    gross: sayilar[0],
    fuel: sayilar[1] ?? 0,
    wage: sayilar[2] ?? 0,
    fee: sayilar[3] ?? 0,
    note: parcalar.join(' '),
  };
}

module.exports = function registerBusCommands(bot) {
  async function ozetGoster(ctx, month, year) {
    const data = await loadMonth({ month, year });
    return render(ctx, ozetMetni(data), ozetKlavyesi(data));
  }

  bot.command('otobus', async (ctx) => {
    try {
      const { month, year } = currentMonth();
      await ozetGoster(ctx, month, year);
    } catch (error) {
      console.error('otobus error:', error);
      await ctx.reply('Otobüs defteri yüklenemedi: ' + error.message);
    }
  });

  bot.action('nav:bus', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const { month, year } = currentMonth();
      await ozetGoster(ctx, month, year);
    } catch (error) {
      console.error('nav:bus error:', error);
      await ctx.reply('Otobüs defteri yüklenemedi: ' + error.message);
    }
  });

  bot.action(/^bus:m:(\d{4}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const year = Number(ctx.match[1]);
    const month = Number(ctx.match[2]);
    if (month < 1 || month > 12) return undefined;
    try {
      return await ozetGoster(ctx, month, year);
    } catch (error) {
      console.error('bus:m error:', error);
      return ctx.reply('Otobüs defteri yüklenemedi: ' + error.message);
    }
  });

  bot.action('bus:help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(KULLANIM, Markup.inlineKeyboard([backRow('nav:bus')]));
  });

  bot.action(/^bus:pdf:(\d{4}):(\d{1,2})$/, async (ctx) => {
    const year = Number(ctx.match[1]);
    const month = Number(ctx.match[2]);
    await ctx.answerCbQuery('Rapor hazırlanıyor…');
    try {
      const report = await monthReport({ month, year });
      await ctx.replyWithChatAction('upload_document');
      const buffer = await pdfToBuffer(buildBusMonthReportPdf(report));
      const t = report.totals;
      await ctx.replyWithDocument(
        { source: buffer, filename: fileNameFor('bus', year, month) },
        {
          caption: [
            '🚌 ' + report.label + ' otobüs raporu',
            'Hasılat: ' + formatCurrency(t.gross) + ' · Kalan: ' + formatCurrency(t.net) + ' (%' + t.margin + ')',
            t.days + ' gün işlendi' + (t.missingDays ? ' · ' + t.missingDays + ' gün kayıtsız' : ''),
          ].join('\n'),
          ...Markup.inlineKeyboard([[cb('◀︎ Defter', 'nav:bus')], homeRow()]),
        }
      );
    } catch (error) {
      console.error('bus:pdf error:', error);
      await ctx.reply('Rapor hazırlanamadı: ' + error.message);
    }
  });

  bot.command('gun', async (ctx) => {
    const args = String(ctx.message?.text || '').split(' ').slice(1).join(' ').trim();
    if (!args) {
      return ctx.reply(KULLANIM, Markup.inlineKeyboard([backRow('nav:bus')]));
    }

    const girdi = satiriCoz(args);
    if (!girdi) {
      return ctx.reply('Satır okunamadı.\n\n' + KULLANIM);
    }

    try {
      const buses = await listBuses();
      const bus = buses.find((item) => item.number === girdi.busNumber);
      if (!bus) {
        return ctx.reply(
          girdi.busNumber + ' numaralı araç kayıtlı değil.\n' +
          (buses.length ? 'Kayıtlı araçlar: ' + buses.map((b) => b.number).join(', ') : 'Henüz araç eklenmemiş.') +
          '\nAracı web panelindeki Otobüs sayfasından ekleyebilirsiniz.'
        );
      }

      const sonuc = await saveDay({ ...girdi, busId: bus.id, source: 'telegram' });
      const gun = sonuc.entry;
      const data = await loadMonth({ month: gun.month, year: gun.year });

      await ctx.reply(
        [
          sonuc.created ? '✅ Gün kaydedildi' : '✏️ Gün güncellendi',
          '',
          'Araç no: ' + bus.number + (bus.label ? ' · ' + bus.label : ''),
          'Tarih: ' + formatDate(gun.date),
          '',
          'Toplam: ' + formatCurrency(gun.gross),
          'Mazot: ' + formatCurrency(gun.fuel),
          'Yövmiye: ' + formatCurrency(gun.wage),
          'Denekçi: ' + formatCurrency(gun.fee),
          gun.other ? 'Diğer: ' + formatCurrency(gun.other) : '',
          'Kalan: ' + formatCurrency(gun.net),
          '',
          'Ay toplamı: ' + formatCurrency(data.totals.net) + ' kalan · ' + data.totals.days + ' gün',
        ].filter(Boolean).join('\n'),
        Markup.inlineKeyboard([
          [cb('🚌 Defter', 'nav:bus'), cb('📄 Ay raporu', 'bus:pdf:' + gun.year + ':' + gun.month)],
          homeRow(),
        ])
      );
    } catch (error) {
      console.error('gun error:', error);
      await ctx.reply('Kaydedilemedi: ' + error.message);
    }
  });
};
