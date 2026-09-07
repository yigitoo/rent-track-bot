const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { formatCurrency, formatDate, formatMonthYear, now } = require('./format');

/* Panel paleti, kâğıt için biraz koyultulmuş: ekranda cam olan yüzeyler
   burada düz dolgu. Baskıda saydamlık okunurluğu düşürür. */
const C = {
  ink: '#0c1220',
  ink2: '#4a5771',
  ink3: '#7b8aa4',
  line: '#dfe4ee',
  lineSoft: '#eef1f7',
  panel: '#f5f7fb',
  white: '#ffffff',
  accent: '#2b54d4',
  accentSoft: '#eaeffc',
  ok: '#0f7a55',
  okSoft: '#e2f2eb',
  warn: '#a2660f',
  warnSoft: '#faf0dd',
  bad: '#bd3a2c',
  badSoft: '#fae8e6',
  calm: '#3d5a80',
  calmSoft: '#eaeff6',
  mark: '#ffcf9b',
};

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');
const FONTS = {
  regular: path.join(FONT_DIR, 'Inter-400.ttf'),
  semi: path.join(FONT_DIR, 'Inter-600.ttf'),
  bold: path.join(FONT_DIR, 'Inter-700.ttf'),
};

function registerFonts(doc) {
  doc.registerFont('body', fs.readFileSync(FONTS.regular));
  doc.registerFont('semi', fs.readFileSync(FONTS.semi));
  doc.registerFont('bold', fs.readFileSync(FONTS.bold));
  doc.font('body');
}

/* Marka işareti vektör olarak çizilir: her ölçekte keskin kalır,
   PNG gömmeye gerek yok. */
function drawMark(doc, x, y, size) {
  const s = size / 512;
  doc.save();
  doc.translate(x, y).scale(s);
  doc.roundedRect(0, 0, 512, 512, 118).fill(C.accent);
  doc.lineCap('round').strokeColor(C.white);
  doc.lineWidth(54).moveTo(152, 150).lineTo(256, 366).stroke();
  doc.lineWidth(42).moveTo(256, 366).lineTo(360, 132).stroke();
  doc.circle(360, 132, 21).fill(C.mark);
  doc.restore();
}

function header(doc, { title, subtitle, meta }) {
  const width = doc.page.width;
  const left = doc.page.margins.left;
  const right = width - doc.page.margins.right;
  const band = 112;

  // Panelin ortam zeminiyle aynı fikir: mürekkep zemin, solda kobalt ışık.
  doc.save();
  const wash = doc.linearGradient(0, 0, width, band);
  wash.stop(0, '#16224a').stop(0.52, '#0c1220').stop(1, '#1d2f6b');
  doc.rect(0, 0, width, band).fill(wash);
  doc.rect(0, band - 3, width, 3).fill(C.accent);
  doc.restore();

  const markSize = 54;
  const markTop = 26;
  drawMark(doc, left, markTop, markSize);

  const textX = left + markSize + 16;

  doc.fillColor(C.white).font('bold').fontSize(18)
    .text('Vedat Gayrimenkul', textX, markTop + 2, { lineBreak: false });

  doc.fillColor('#93a8e8').font('semi').fontSize(9)
    .text(title.toLocaleUpperCase('tr-TR'), textX, markTop + 26, {
      characterSpacing: 1.4,
      lineBreak: false,
    });

  doc.fillColor('#b9c6e6').font('body').fontSize(9.5)
    .text(subtitle, textX, markTop + 42, {
      width: right - textX - 150,
      lineBreak: false,
      ellipsis: true,
    });

  doc.fillColor('#7f92c4').font('body').fontSize(8.5)
    .text(meta || formatDate(now().toDate()), right - 150, markTop + 42, {
      width: 150,
      align: 'right',
      lineBreak: false,
    });

  doc.fillColor(C.ink);
  doc.y = band + 22;
}

function footer(doc, pageNumber) {
  const y = doc.page.height - 42;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // Alt boşluk sıfırlanmazsa pdfkit altbilgiyi "taşma" sayıp boş bir sayfa açar.
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.font('body').fontSize(8).fillColor(C.ink3);
  doc.text('Vedat Gayrimenkul paneli · ' + formatDate(now().toDate()), left, y + 8, { lineBreak: false });
  doc.text('Sayfa ' + pageNumber, left, y + 8, {
    width: right - left,
    align: 'right',
    lineBreak: false,
  });

  doc.page.margins.bottom = bottomMargin;
}

function statCards(doc, cards) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;
  const gap = 10;
  const cardWidth = (usable - gap * (cards.length - 1)) / cards.length;
  const top = doc.y;
  const height = 58;

  // Kart sayısı arttıkça tutar sığmayıp etiketin üstüne biniyordu; punto
  // kutuya göre küçülür, sığmıyorsa da hiç taşmaz.
  const pad = cardWidth < 100 ? 10 : 13;
  const inner = cardWidth - pad * 2;
  // tnum glifleri ölçümden bir tık geniş basıyor; %6 pay bırakılır.
  const fits = inner * 0.94;
  let valueSize = 15;
  doc.font('bold');
  while (valueSize > 8 && cards.some((card) => doc.fontSize(valueSize).widthOfString(String(card.value)) > fits)) {
    valueSize -= 0.5;
  }

  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + gap);
    doc.roundedRect(x, top, cardWidth, height, 12).fillAndStroke(card.bg || C.panel, C.line);
    doc.fillColor(card.fg || C.ink).font('bold').fontSize(valueSize)
      .text(card.value, x + pad, top + 14 + (15 - valueSize) / 2, {
        width: inner,
        lineBreak: false,
        ellipsis: true,
        features: ['tnum'],
      });
    doc.fillColor(C.ink3).font('semi').fontSize(cardWidth < 100 ? 6.8 : 7.5)
      .text(card.label.toLocaleUpperCase('tr-TR'), x + pad, top + 38, {
        width: inner,
        characterSpacing: cardWidth < 100 ? 0.3 : 0.7,
        lineBreak: false,
        ellipsis: true,
      });
  });

  doc.fillColor(C.ink);
  doc.y = top + height + 18;
}

function sectionTitle(doc, text, hint) {
  doc.font('bold').fontSize(11.5).fillColor(C.ink).text(text, doc.page.margins.left, doc.y);
  if (hint) {
    doc.font('body').fontSize(8.5).fillColor(C.ink3).text(hint, doc.page.margins.left, doc.y + 1);
  }
  doc.moveDown(0.5);
  doc.fillColor(C.ink);
}

/* Tablo yardımı: sütun genişlikleri oran olarak verilir. */
function table(doc, { columns, rows, rowHeight = 20, onNewPage }) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  const widths = columns.map((column) => (column.weight / totalWeight) * usable);

  function drawHead() {
    const top = doc.y;
    doc.roundedRect(left, top, usable, 22, 6).fill(C.panel);
    let x = left;
    columns.forEach((column, index) => {
      const pad = column.tight ? 2 : 8;
      doc.fillColor(C.ink3).font('semi').fontSize(column.tight ? 6.8 : 7.5)
        .text(column.label.toLocaleUpperCase('tr-TR'), x + pad, top + (column.tight ? 8 : 7.5), {
          width: widths[index] - pad * 2,
          align: column.align || 'left',
          characterSpacing: column.tight ? 0 : 0.6,
          lineBreak: false,
        });
      x += widths[index];
    });
    doc.y = top + 22;
    doc.fillColor(C.ink);
  }

  drawHead();

  rows.forEach((row) => {
    if (doc.y + rowHeight > doc.page.height - 54) {
      doc.addPage();
      onNewPage?.(doc);
      drawHead();
    }

    const top = doc.y;
    let x = left;
    columns.forEach((column, index) => {
      const cell = row[index];
      const value = typeof cell === 'object' && cell !== null ? cell : { text: cell };
      const pad = column.tight ? 2 : 8;
      if (value.bg) {
        doc.roundedRect(x + 3, top + 2, widths[index] - 6, rowHeight - 5, 4).fill(value.bg);
      }
      doc.fillColor(value.color || C.ink)
        .font(value.font || 'body')
        .fontSize(value.size || 8.5)
        .text(String(value.text ?? ''), x + pad, top + rowHeight / 2 - 4.5, {
          width: widths[index] - pad * 2,
          align: column.align || 'left',
          lineBreak: false,
          ellipsis: true,
          features: ['tnum'],
        });
      x += widths[index];
    });

    doc.moveTo(left, top + rowHeight).lineTo(left + usable, top + rowHeight)
      .lineWidth(0.5).strokeColor(C.lineSoft).stroke();
    doc.y = top + rowHeight;
  });

  doc.fillColor(C.ink);
  doc.y += 12;
}

function trendBars(doc, series) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;
  const height = 84;
  const top = doc.y;
  const max = Math.max(1, ...series.map((item) => Math.max(item.expected, item.received, item.expense)));
  const slot = usable / series.length;

  series.forEach((item, index) => {
    const x = left + index * slot;
    const expectedHeight = (item.expected / max) * height;
    const receivedHeight = (item.received / max) * height;
    const expenseHeight = (item.expense / max) * height;

    doc.rect(x + slot * 0.14, top + height - expectedHeight, slot * 0.72, expectedHeight).fill(C.calmSoft);
    doc.rect(x + slot * 0.2, top + height - receivedHeight, slot * 0.34, receivedHeight).fill(C.accent);
    doc.rect(x + slot * 0.6, top + height - expenseHeight, slot * 0.2, expenseHeight).fill(C.warn);

    doc.fillColor(C.ink3).font('semi').fontSize(6.8)
      .text(item.short, x, top + height + 5, { width: slot, align: 'center', lineBreak: false });
  });

  doc.moveTo(left, top + height).lineTo(left + usable, top + height)
    .lineWidth(0.6).strokeColor(C.line).stroke();

  doc.fillColor(C.ink);
  doc.y = top + height + 16;

  doc.font('body').fontSize(7.5).fillColor(C.ink3);
  const legend = [['Beklenen', C.calmSoft, C.calm], ['Tahsilat', C.accent, null], ['Gider', C.warn, null]];
  let lx = left;
  legend.forEach(([label, color, stroke]) => {
    doc.circle(lx + 3, doc.y + 3, 3.2);
    if (stroke) doc.lineWidth(0.7).fillAndStroke(color, stroke);
    else doc.fill(color);
    doc.fillColor(C.ink3).text(label, lx + 11, doc.y, { lineBreak: false });
    lx += 62;
  });
  doc.y += 14;
  doc.fillColor(C.ink);
}

const CELL_STYLE = {
  paid: { bg: C.okSoft, color: C.ok, text: 'Ö' },
  partial: { bg: C.warnSoft, color: C.warn, text: 'E' },
  unpaid: { bg: C.badSoft, color: C.bad, text: '·' },
  future: { bg: C.lineSoft, color: C.ink3, text: '' },
  outside: { bg: null, color: C.ink3, text: '–' },
};

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];


const STATUS_STYLE = {
  paid: { label: 'Ödendi', color: C.ok, bg: C.okSoft },
  partial: { label: 'Eksik', color: C.warn, bg: C.warnSoft },
  overdue: { label: 'Gecikti', color: C.bad, bg: C.badSoft },
  upcoming: { label: 'Yaklaşıyor', color: C.calm, bg: C.calmSoft },
  pending: { label: 'Ödenecek', color: C.ink2, bg: null },
  future: { label: 'Sırada', color: C.ink3, bg: null },
  outside: { label: 'Kiracı değil', color: C.ink3, bg: null },
  archived: { label: 'Arşiv', color: C.ink3, bg: C.lineSoft },
};

/* Aylık dönem raporu · A4 dikey. Bir ayın defteri: kim ödedi, kim kaldı,
   o ay ne harcandı. Telegram'dan tek dokunuşla istenen rapor budur. */
function buildMonthReportPdf(report) {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  registerFonts(doc);

  header(doc, {
    title: 'Dönem raporu',
    subtitle: report.label + ' · ' + report.totals.tenantCount + ' kiracı',
    meta: formatDate(now().toDate()),
  });

  statCards(doc, [
    { label: 'Beklenen', value: formatCurrency(report.totals.expected), fg: C.ink },
    { label: 'Tahsil edilen', value: formatCurrency(report.totals.received), fg: C.accent, bg: C.accentSoft },
    { label: 'Açık bakiye', value: formatCurrency(report.totals.outstanding), fg: C.bad, bg: C.badSoft },
    { label: 'Gider', value: formatCurrency(report.totals.expense), fg: C.warn, bg: C.warnSoft },
    { label: 'Net gelir', value: formatCurrency(report.totals.net), fg: C.ok, bg: C.okSoft },
  ]);

  sectionTitle(
    doc,
    'Kiracı durumu',
    report.totals.paidCount + ' ödendi · ' + report.totals.partialCount + ' eksik · ' +
      report.totals.overdueCount + ' geciken · %' + report.totals.rate + ' tahsilat'
  );
  table(doc, {
    columns: [
      { label: 'Kiracı', weight: 2.6 },
      { label: 'Beklenen', weight: 1.5, align: 'right' },
      { label: 'Ödenen', weight: 1.5, align: 'right' },
      { label: 'Kalan', weight: 1.4, align: 'right' },
      { label: 'Son ödeme', weight: 1.5, align: 'right' },
      { label: 'Durum', weight: 1.4, align: 'center' },
    ],
    rows: report.rows.map((row) => {
      const style = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
      return [
        { text: row.name + (row.archived ? ' (arşiv)' : ''), font: 'semi' },
        formatCurrency(row.expected),
        { text: formatCurrency(row.paid), color: row.paid ? C.accent : C.ink3, font: 'semi' },
        { text: formatCurrency(row.remaining), color: row.remaining > 0 ? C.bad : C.ink3 },
        { text: formatDate(row.dueDate) + (row.isDeferred ? ' *' : ''), color: C.ink2, size: 8 },
        { text: style.label, bg: style.bg, color: style.color, font: 'semi', size: 7.8 },
      ];
    }),
    onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: report.label + ' · kiracı durumu (devam)' }),
  });

  if (report.rows.some((row) => row.isDeferred)) {
    doc.font('body').fontSize(7.5).fillColor(C.ink3)
      .text('* son ödeme tarihi ertelendi', doc.page.margins.left, doc.y);
    doc.moveDown(1);
  }

  sectionTitle(doc, 'Tahsilat hareketleri', report.payments.length + ' kayıt');
  if (report.payments.length) {
    table(doc, {
      columns: [
        { label: 'Tarih', weight: 1.5 },
        { label: 'Kiracı', weight: 3 },
        { label: 'Not', weight: 2.6 },
        { label: 'Tutar', weight: 1.6, align: 'right' },
      ],
      rows: report.payments.map((item) => [
        { text: formatDate(item.date), color: C.ink2 },
        { text: item.tenantName, font: 'semi' },
        { text: item.note || (item.source === 'telegram' ? 'Telegram' : 'Panel'), color: C.ink3, size: 8 },
        { text: formatCurrency(item.amount), color: C.accent, font: 'semi' },
      ]),
      onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: report.label + ' · tahsilat (devam)' }),
    });
  } else {
    doc.font('body').fontSize(9).fillColor(C.ink3)
      .text('Bu dönemde tahsilat kaydı yok.', doc.page.margins.left, doc.y);
    doc.moveDown(1.4);
  }

  const dues = report.dues;
  if (dues && dues.rows.length) {
    sectionTitle(
      doc,
      'Aidat takibi',
      dues.totals.paidCount + '/' + dues.totals.dueCount + ' ödendi · ' +
        formatCurrency(dues.totals.settled) + ' / ' + formatCurrency(dues.totals.expected) +
        (dues.totals.overdueCount ? ' · ' + dues.totals.overdueCount + ' geciken' : '')
    );
    table(doc, {
      columns: [
        { label: 'Aidat kalemi', weight: 3 },
        { label: 'İlgili kiracı', weight: 2 },
        { label: 'Son ödeme', weight: 1.5, align: 'right' },
        { label: 'Tutar', weight: 1.5, align: 'right' },
        { label: 'Durum', weight: 1.4, align: 'center' },
      ],
      rows: dues.rows.map((row) => {
        const style = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
        return [
          { text: row.title, font: 'semi' },
          { text: row.tenantName || 'Genel', color: C.ink3 },
          { text: formatDate(row.dueDate), color: C.ink2, size: 8 },
          { text: formatCurrency(row.amount), color: row.paid ? C.ok : C.warn, font: 'semi' },
          { text: row.paid ? 'Ödendi' : style.label, bg: row.paid ? C.okSoft : style.bg, color: row.paid ? C.ok : style.color, font: 'semi', size: 7.8 },
        ];
      }),
      onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: report.label + ' · aidat (devam)' }),
    });
  }

  if (report.expenses.length) {
    sectionTitle(doc, 'Giderler', formatCurrency(report.totals.expense) + ' toplam');
    table(doc, {
      columns: [
        { label: 'Tarih', weight: 1.5 },
        { label: 'Kalem', weight: 3 },
        { label: 'Kategori', weight: 2 },
        { label: 'Tutar', weight: 1.6, align: 'right' },
      ],
      rows: report.expenses.map((item) => [
        { text: formatDate(item.date), color: C.ink2 },
        { text: item.title, font: 'semi' },
        { text: item.categoryLabel, color: C.ink3 },
        { text: formatCurrency(item.amount), color: C.warn, font: 'semi' },
      ]),
      onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: report.label + ' · giderler (devam)' }),
    });
  }

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    footer(doc, index + 1);
  }

  return doc;
}

/* Dönem raporu (kayan aralık) · A4 dikey */
function buildRangeReportPdf(report) {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  registerFonts(doc);

  header(doc, {
    title: 'Dönem raporu',
    subtitle: report.series[0].label + ' - ' + report.series[report.series.length - 1].label,
    meta: 'Son ' + report.months + ' ay',
  });

  statCards(doc, [
    { label: 'Toplam tahsilat', value: formatCurrency(report.totals.received), fg: C.accent, bg: C.accentSoft },
    { label: 'Toplam gider', value: formatCurrency(report.totals.expense), fg: C.warn, bg: C.warnSoft },
    { label: 'Net gelir', value: formatCurrency(report.totals.net), fg: C.ok, bg: C.okSoft },
    { label: 'Tahsilat oranı', value: '%' + report.totals.rate, fg: C.ink },
  ]);

  sectionTitle(doc, 'Aylara göre tahsilat ve gider');
  trendBars(doc, report.series);

  sectionTitle(doc, 'Aylık döküm');
  table(doc, {
    columns: [
      { label: 'Dönem', weight: 2 },
      { label: 'Beklenen', weight: 1.6, align: 'right' },
      { label: 'Tahsilat', weight: 1.6, align: 'right' },
      { label: 'Gider', weight: 1.4, align: 'right' },
      { label: 'Net', weight: 1.6, align: 'right' },
      { label: 'Oran', weight: 1, align: 'right' },
    ],
    rows: report.series.map((item) => [
      { text: item.label, font: 'semi' },
      formatCurrency(item.expected),
      { text: formatCurrency(item.received), color: C.accent, font: 'semi' },
      { text: formatCurrency(item.expense), color: C.warn },
      { text: formatCurrency(item.net), font: 'semi' },
      '%' + item.rate,
    ]),
    onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: 'Aylık döküm (devam)' }),
  });

  sectionTitle(doc, 'Kiracı bazında tahsilat');
  table(doc, {
    columns: [
      { label: 'Kiracı', weight: 3 },
      { label: 'Beklenen', weight: 1.6, align: 'right' },
      { label: 'Tahsil edilen', weight: 1.6, align: 'right' },
      { label: 'Açık', weight: 1.5, align: 'right' },
      { label: 'Oran', weight: 1, align: 'right' },
    ],
    rows: report.byTenant.map((item) => [
      { text: item.name, font: 'semi' },
      formatCurrency(item.expected),
      { text: formatCurrency(item.received), color: C.accent, font: 'semi' },
      { text: formatCurrency(item.outstanding), color: item.outstanding > 0 ? C.bad : C.ink3 },
      '%' + item.rate,
    ]),
    onNewPage: (d) => header(d, { title: 'Dönem raporu', subtitle: 'Kiracı bazında tahsilat (devam)' }),
  });

  if (report.byCategory.length) {
    sectionTitle(doc, 'Gider kırılımı');
    table(doc, {
      columns: [
        { label: 'Kategori', weight: 3 },
        { label: 'Tutar', weight: 2, align: 'right' },
      ],
      rows: report.byCategory.map((item) => [
        { text: item.label, font: 'semi' },
        { text: formatCurrency(item.total), color: C.warn },
      ]),
    });
  }

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    footer(doc, index + 1);
  }

  return doc;
}

/* Yıllık rapor · A4 yatay, kiracı × ay tablosu */
function buildAnnualReportPdf(annual) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 38, bufferPages: true });
  registerFonts(doc);

  const title = annual.year + ' yıllık raporu';
  header(doc, {
    title,
    subtitle: annual.totals.tenantCount + ' kiracı · yıl içinde katılan ' + annual.totals.newTenants,
    meta: formatDate(now().toDate()),
  });

  statCards(doc, [
    { label: 'Beklenen', value: formatCurrency(annual.totals.expected), fg: C.ink },
    { label: 'Tahsil edilen', value: formatCurrency(annual.totals.received), fg: C.accent, bg: C.accentSoft },
    { label: 'Gider', value: formatCurrency(annual.totals.expense), fg: C.warn, bg: C.warnSoft },
    { label: 'Net gelir', value: formatCurrency(annual.totals.net), fg: C.ok, bg: C.okSoft },
    { label: 'Tahsilat oranı', value: '%' + annual.totals.rate, fg: C.ink },
  ]);

  sectionTitle(doc, 'Aylara göre', 'Beklenen, tahsil edilen ve gider');
  trendBars(doc, annual.series);

  sectionTitle(doc, 'Kiracı × ay', 'Ö ödendi · E eksik · · ödenmedi · – henüz kiracı değil');

  const monthColumns = MONTH_SHORT.map((label) => ({ label, weight: 0.66, align: 'center', tight: true }));
  table(doc, {
    rowHeight: 22,
    columns: [
      { label: 'Kiracı', weight: 3.1 },
      { label: 'Dahil olduğu ay', weight: 2.05, tight: true },
      ...monthColumns,
      { label: 'Tahsilat', weight: 1.6, align: 'right' },
      { label: 'Oran', weight: 0.95, align: 'right', tight: true },
    ],
    rows: annual.rows.map((row) => [
      { text: row.name, font: 'semi' },
      { text: row.startLabel, color: C.ink2, size: 7.8 },
      ...row.cells.map((cell) => {
        const style = CELL_STYLE[cell.state];
        return {
          text: cell.isStart ? '◆' : style.text,
          bg: cell.isStart ? C.accentSoft : style.bg,
          color: cell.isStart ? C.accent : style.color,
          font: 'semi',
          size: 8,
        };
      }),
      { text: formatCurrency(row.received), color: C.accent, font: 'semi' },
      '%' + row.rate,
    ]),
    onNewPage: (d) => header(d, { title, subtitle: 'Kiracı × ay (devam)' }),
  });

  doc.font('body').fontSize(7.5).fillColor(C.ink3)
    .text('◆ kiracının portföye katıldığı ay', doc.page.margins.left, doc.y);
  doc.moveDown(1);

  if (annual.dues?.rows.length) {
    sectionTitle(
      doc,
      'Aidat × ay',
      'Ö ödendi · · ödenmedi · – kapsam dışı · ' +
        formatCurrency(annual.dues.totals.settled) + ' / ' + formatCurrency(annual.dues.totals.expected)
    );
    table(doc, {
      rowHeight: 22,
      columns: [
        { label: 'Aidat kalemi', weight: 3.1 },
        { label: 'İlgili kiracı', weight: 2.05, tight: true },
        ...MONTH_SHORT.map((label) => ({ label, weight: 0.66, align: 'center', tight: true })),
        { label: 'Ödenen', weight: 1.6, align: 'right' },
        { label: 'Oran', weight: 0.95, align: 'right', tight: true },
      ],
      rows: annual.dues.rows.map((row) => [
        { text: row.title, font: 'semi' },
        { text: row.tenantName || 'Genel', color: C.ink2, size: 7.8 },
        ...row.months.map((cell) => {
          const style = cell.paid
            ? { bg: C.okSoft, color: C.ok, text: 'Ö' }
            : !cell.covered
              ? { bg: null, color: C.ink3, text: '–' }
              : cell.status === 'overdue'
                ? { bg: C.badSoft, color: C.bad, text: '·' }
                : { bg: C.lineSoft, color: C.ink3, text: '' };
          return { text: style.text, bg: style.bg, color: style.color, font: 'semi', size: 8 };
        }),
        { text: formatCurrency(row.settled), color: C.ok, font: 'semi' },
        '%' + row.rate,
      ]),
      onNewPage: (d) => header(d, { title, subtitle: 'Aidat × ay (devam)' }),
    });
  }

  if (annual.byCategory.length) {
    sectionTitle(doc, 'Gider kırılımı');
    table(doc, {
      columns: [
        { label: 'Kategori', weight: 3 },
        { label: 'Tutar', weight: 2, align: 'right' },
      ],
      rows: annual.byCategory.map((item) => [
        { text: item.label, font: 'semi' },
        { text: formatCurrency(item.total), color: C.warn },
      ]),
    });
  }

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    footer(doc, index + 1);
  }

  return doc;
}

function fileNameFor(kind, value, extra) {
  if (kind === 'annual') return 'vedat-gayrimenkul-' + value + '-yillik.pdf';
  if (kind === 'month') {
    return 'vedat-gayrimenkul-' + value + '-' + String(extra).padStart(2, '0') + '.pdf';
  }
  return 'vedat-gayrimenkul-son-' + value + '-ay.pdf';
}

/* Telegram dosya olarak ister, HTTP akış olarak. Aynı belgeyi ikinciye
   çevirmek için buffer'a toplarız; doc.end() yalnız burada çağrılır. */
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = {
  buildAnnualReportPdf,
  buildMonthReportPdf,
  buildRangeReportPdf,
  fileNameFor,
  pdfToBuffer,
};
