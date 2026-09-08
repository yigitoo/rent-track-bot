const { Markup } = require('telegraf');
const { now } = require('./format');

/* Bot menüsü: her şey butonla yürür. Komut yazmak hâlâ çalışır ama
   gündelik kullanımda "/" tuşlamaya gerek kalmaz. */

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTH_LONG = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function cb(label, data) {
  return Markup.button.callback(label, data);
}

function panelUrl() {
  return process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '');
}

function mainMenu() {
  const rows = [
    [cb('📊 Bu ayın durumu', 'nav:status'), cb('🧾 Ödeme tablosu', 'nav:grid')],
    [cb('🏢 Aidat takibi', 'nav:dues'), cb('🚌 Otobüs hattı', 'nav:bus')],
    [cb('📉 Giderler', 'nav:expenses'), cb('📄 Rapor / PDF', 'nav:reports')],
    [cb('⏳ Kira ertele', 'menu_kiraertele'), cb('👥 Kiracılar', 'nav:tenants')],
    [cb('🗓 Takvim', 'menu_takvim'), cb('➕ Ödeme ekle', 'menu_odemeekle')],
    [cb('🔔 Bildirimler', 'nav:notifications'), cb('⚙️ Ayarlar', 'nav:settings')],
    [cb('❓ Yardım', 'nav:help')],
  ];

  const url = panelUrl();
  if (url) rows.push([Markup.button.url('🌐 Web paneli', url)]);

  return Markup.inlineKeyboard(rows);
}

function homeRow() {
  return [cb('🏠 Ana menü', 'nav:home')];
}

function backRow(target, label = '◀︎ Geri') {
  return [cb(label, target), cb('🏠 Ana menü', 'nav:home')];
}

/* Seçilebilir yıllar: geçmişe üç yıl, geleceğe bir yıl.
   Kutucuklu tabloda ileri dönem de işaretlenebilsin diye ileri yıl da var. */
function yearRange(reference = now().year()) {
  return [reference - 3, reference - 2, reference - 1, reference, reference + 1];
}

function yearRow(prefix, active) {
  return yearRange().map((year) =>
    cb((year === active ? '· ' : '') + year + (year === active ? ' ·' : ''), prefix + year)
  );
}

/* Telegram satır başına dört düğmeden fazlasını mobilde ezik gösteriyor. */
function chunk(items, size) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function monthButtons(prefix, { marks = {}, columns = 3 } = {}) {
  return chunk(
    MONTH_SHORT.map((label, index) => {
      const month = index + 1;
      const mark = marks[month] ? marks[month] + ' ' : '';
      return cb(mark + label, prefix + month);
    }),
    columns
  );
}

/* Geri düğmesine basıldığında yeni mesaj yağmuru olmasın diye mevcut mesaj
   düzenlenir; içerik aynıysa Telegram hata döndürür, o hata yutulur. */
async function render(ctx, text, extra = {}) {
  if (ctx.callbackQuery) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (error) {
      if (String(error?.description || error?.message || '').includes('message is not modified')) {
        return undefined;
      }
      return ctx.reply(text, extra);
    }
  }
  return ctx.reply(text, extra);
}

module.exports = {
  MONTH_LONG,
  MONTH_SHORT,
  backRow,
  cb,
  chunk,
  homeRow,
  mainMenu,
  monthButtons,
  panelUrl,
  render,
  yearRange,
  yearRow,
};
