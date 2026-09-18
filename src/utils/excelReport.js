const ExcelJS = require('exceljs');

const COLORS = {
  ink: 'FF0C1220',
  ink2: 'FF4A5771',
  ink3: 'FF7B8AA4',
  accent: 'FF2B54D4',
  accentSoft: 'FFE8EEFF',
  line: 'FFD9E0ED',
  lineStrong: 'FFBFC9DC',
  white: 'FFFFFFFF',
  ok: 'FF0F7A55',
  okSoft: 'FFE6F4EE',
  warn: 'FFA2660F',
  warnSoft: 'FFFCF2DE',
  bad: 'FFBD3A2C',
  badSoft: 'FFFDEAE7',
  calm: 'FF3D5A80',
  calmSoft: 'FFEAF0F8',
  outside: 'FFF3F5F8',
};

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const STATUS = {
  paid: { label: 'Ödendi', color: COLORS.ok, fill: COLORS.okSoft },
  partial: { label: 'Eksik ödeme', color: COLORS.warn, fill: COLORS.warnSoft },
  overdue: { label: 'Gecikti', color: COLORS.bad, fill: COLORS.badSoft },
  upcoming: { label: 'Yaklaşıyor', color: COLORS.calm, fill: COLORS.calmSoft },
  pending: { label: 'Ödenecek', color: COLORS.ink2, fill: null },
  future: { label: 'Sırada', color: COLORS.ink3, fill: COLORS.outside },
  outside: { label: 'Sözleşme öncesi', color: COLORS.ink3, fill: null },
  archived: { label: 'Arşiv', color: COLORS.ink3, fill: COLORS.outside },
  unpaid: { label: 'Ödenmedi', color: COLORS.bad, fill: COLORS.badSoft },
};

const BORDER = {
  top: { style: 'thin', color: { argb: COLORS.lineStrong } },
  bottom: { style: 'thin', color: { argb: COLORS.line } },
  left: { style: 'thin', color: { argb: COLORS.line } },
  right: { style: 'thin', color: { argb: COLORS.line } },
};

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateCell(value) {
  return validDate(value) || '';
}

function amountFormat(cell) {
  cell.numFmt = '#,##0.00 "TL"';
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
}

function titleBlock(sheet, lastColumn, title, subtitle) {
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.mergeCells(`A2:${lastColumn}2`);
  const titleCell = sheet.getCell('A1');
  const subtitleCell = sheet.getCell('A2');

  titleCell.value = title;
  titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.border = { bottom: BORDER.bottom };
  sheet.getRow(1).height = 32;

  subtitleCell.value = subtitle;
  subtitleCell.font = { name: 'Aptos', size: 10, color: { argb: COLORS.ink2 } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 8;
}

function styleTableHeader(row) {
  row.height = 25;
  row.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ink } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: BORDER.top, bottom: BORDER.top };
  });
}

function styleBodyRow(row, index) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 10, color: { argb: COLORS.ink } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: BORDER.bottom };
    if (index % 2 === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFD' } };
    }
  });
}

function styleStatusCell(cell, state) {
  const style = STATUS[state] || STATUS.pending;
  cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: style.color } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  if (style.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
  }
}

function styleTotalRow(row, lastColumn) {
  row.height = 25;
  for (let index = 1; index <= lastColumn; index += 1) {
    const cell = row.getCell(index);
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORS.ink } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accentSoft } };
    cell.border = { top: BORDER.top };
    cell.alignment = { vertical: 'middle', horizontal: index === 1 ? 'left' : 'right' };
  }
}

function configureSheet(sheet, widths) {
  sheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    horizontalDpi: 300,
    verticalDpi: 300,
  };
  sheet.headerFooter.oddFooter = '&LVedat Gayrimenkul&R&"Aptos"Sayfa &P / &N';
  sheet.columns = widths.map((width) => ({ width }));
}

function addTable(sheet, name, headerRow, rows, startRow, widths) {
  const endRow = startRow + Math.max(rows.length, 1);
  const lastColumn = headerRow.length;
  const endColumn = sheet.getColumn(lastColumn).letter;
  const tableRows = rows.length ? rows : [headerRow.map((unused, index) => (index === 0 ? 'Kayıt yok' : ''))];

  sheet.addTable({
    name,
    ref: `A${startRow}:${endColumn}${endRow}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
      showFirstColumn: false,
      showLastColumn: false,
    },
    columns: headerRow.map((nameValue) => ({ name: nameValue })),
    rows: tableRows,
  });

  styleTableHeader(sheet.getRow(startRow));
  tableRows.forEach((unused, index) => styleBodyRow(sheet.getRow(startRow + 1 + index), index));
  sheet.columns = widths.map((width) => ({ width }));
  return { endRow, lastColumn };
}

function createWorkbook(subject) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vedat Gayrimenkul';
  workbook.lastModifiedBy = 'Vedat Gayrimenkul';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.title = subject;
  workbook.properties.subject = subject;
  workbook.properties.company = 'Vedat Gayrimenkul';
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

function buildAnnualPaymentsWorkbook(annual) {
  const workbook = createWorkbook(`${annual.year} ödeme tablosu`);
  const headers = ['Kiracı', 'Dahil olduğu ay', ...MONTH_SHORT, 'Beklenen', 'Tahsil edilen', 'Açık', 'Oran'];
  const widths = [26, 18, ...MONTH_SHORT.map(() => 13), 16, 17, 15, 11];
  const sheet = workbook.addWorksheet('Yıl tablosu');
  configureSheet(sheet, widths);
  titleBlock(
    sheet,
    'R',
    `${annual.year} ödeme tablosu`,
    `${annual.totals.tenantCount} kiracı · ${annual.totals.newTenants || 0} yeni kayıt · dosya oluşturuldu: ${new Intl.DateTimeFormat('tr-TR').format(new Date())}`
  );

  const visibleRows = (annual.rows || []).filter((row) => !row.archived);
  const rows = visibleRows.map((row) => [
    row.name,
    row.startLabel,
    ...row.cells.map((cell) => (STATUS[cell.state] || STATUS.pending).label),
    row.expected,
    row.received,
    row.outstanding,
    row.rate,
  ]);
  addTable(sheet, 'YearPaymentTable', headers, rows, 4, widths);

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    row.slice(2, 14).forEach((state, monthIndex) => {
      styleStatusCell(excelRow.getCell(3 + monthIndex), visibleRows[rowIndex].cells[monthIndex].state);
    });
    [15, 16, 17].forEach((column) => amountFormat(excelRow.getCell(column)));
    excelRow.getCell(18).numFmt = '0"%"';
    excelRow.getCell(18).alignment = { vertical: 'middle', horizontal: 'right' };
    excelRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const totalRowNumber = 6 + rows.length;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = 'Toplam';
  totalRow.getCell(15).value = annual.totals.expected;
  totalRow.getCell(16).value = annual.totals.received;
  totalRow.getCell(17).value = Math.max(annual.totals.expected - annual.totals.received, 0);
  totalRow.getCell(18).value = annual.totals.rate;
  styleTotalRow(totalRow, 18);
  [15, 16, 17].forEach((column) => amountFormat(totalRow.getCell(column)));
  totalRow.getCell(18).numFmt = '0"%"';

  sheet.autoFilter = { from: 'A4', to: 'R' + (4 + Math.max(rows.length, 1)) };
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }];

  const summary = workbook.addWorksheet('Aylık özet');
  const summaryHeaders = ['Dönem', 'Beklenen', 'Tahsil edilen', 'Gider', 'Net', 'Tahsilat oranı'];
  const summaryWidths = [22, 18, 19, 16, 16, 17];
  configureSheet(summary, summaryWidths);
  titleBlock(summary, 'F', `${annual.year} aylık özet`, 'Yıl tablosundaki dönem toplamları ve tahsilat oranı.');
  const summaryRows = annual.series.map((item) => [item.label, item.expected, item.received, item.expense, item.net, item.rate]);
  addTable(summary, 'AnnualMonthlySummaryTable', summaryHeaders, summaryRows, 4, summaryWidths);
  summaryRows.forEach((unused, rowIndex) => {
    const excelRow = summary.getRow(5 + rowIndex);
    [2, 3, 4, 5].forEach((column) => amountFormat(excelRow.getCell(column)));
    excelRow.getCell(6).numFmt = '0"%"';
    excelRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
  });
  summary.autoFilter = { from: 'A4', to: 'F' + (4 + Math.max(summaryRows.length, 1)) };

  return workbook;
}
function buildMonthPaymentsWorkbook(report) {
  const workbook = createWorkbook(`${report.label} ödeme raporu`);
  const headers = ['Kiracı', 'Durum', 'Beklenen', 'Tahsil edilen', 'Kalan', 'Son tahsilat', 'Son ödeme'];
  const widths = [28, 18, 17, 18, 16, 18, 18];
  const visibleRows = (report.rows || []).filter((row) => !row.archived);
  const rows = visibleRows.map((row) => [
    row.name,
    (STATUS[row.status] || STATUS.pending).label,
    row.expected,
    row.paid,
    row.remaining,
    dateCell(row.lastDate),
    dateCell(row.dueDate),
  ]);
  const activeTenantIds = new Set(visibleRows.map((row) => row.tenantId));
  const payments = (report.payments || []).filter(
    (item) => !item.tenantId || activeTenantIds.has(item.tenantId)
  );
  const sheet = workbook.addWorksheet('Ödeme durumu');
  configureSheet(sheet, widths);
  titleBlock(
    sheet,
    'G',
    `${report.label} ödeme raporu`,
    `${report.totals.tenantCount} kiracı · %${report.totals.rate} tahsilat · dosya oluşturuldu: ${new Intl.DateTimeFormat('tr-TR').format(new Date())}`
  );

  const metricLabels = ['Beklenen', 'Tahsil edilen', 'Açık bakiye', 'Gider', 'Net gelir'];
  const metricValues = [
    report.totals.expected,
    report.totals.received,
    report.totals.outstanding,
    report.totals.expense,
    report.totals.net,
  ];
  metricLabels.forEach((label, index) => {
    const column = index + 1;
    const labelCell = sheet.getCell(4, column);
    const valueCell = sheet.getCell(5, column);
    labelCell.value = label;
    labelCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORS.ink2 } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
    valueCell.value = metricValues[index];
    valueCell.font = { name: 'Aptos Display', size: 13, bold: true, color: { argb: index === 1 ? COLORS.accent : COLORS.ink } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 1 ? COLORS.accentSoft : 'FFF8FAFD' } };
    amountFormat(valueCell);
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  sheet.getRow(4).height = 20;
  sheet.getRow(5).height = 26;
  sheet.getRow(6).height = 8;
  sheet.getRow(7).height = 8;

  addTable(sheet, 'MonthlyPaymentStatusTable', headers, rows, 8, widths);
  rows.forEach((unused, rowIndex) => {
    const excelRow = sheet.getRow(9 + rowIndex);
    styleStatusCell(excelRow.getCell(2), visibleRows[rowIndex].status);
    [3, 4, 5].forEach((column) => amountFormat(excelRow.getCell(column)));
    [6, 7].forEach((column) => {
      excelRow.getCell(column).numFmt = 'dd.mm.yyyy';
      excelRow.getCell(column).alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });
  sheet.autoFilter = { from: 'A8', to: 'G' + (8 + Math.max(rows.length, 1)) };

  const paymentsSheet = workbook.addWorksheet('Tahsilat hareketleri');
  const paymentHeaders = ['Tarih', 'Kiracı', 'Tutar', 'Not', 'Kaynak'];
  const paymentWidths = [18, 28, 18, 42, 14];
  configureSheet(paymentsSheet, paymentWidths);
  titleBlock(paymentsSheet, 'E', `${report.label} tahsilat hareketleri`, `${payments.length} ödeme kaydı · tarih sırasıyla`);
  const paymentRows = payments.map((item) => [
    dateCell(item.date),
    item.tenantName,
    item.amount,
    item.note || (item.source === 'telegram' ? 'Telegram' : 'Panel'),
    item.source === 'telegram' ? 'Telegram' : item.source === 'system' ? 'Sistem' : 'Panel',
  ]);
  addTable(paymentsSheet, 'MonthlyPaymentMovementTable', paymentHeaders, paymentRows, 4, paymentWidths);
  paymentRows.forEach((unused, rowIndex) => {
    const excelRow = paymentsSheet.getRow(5 + rowIndex);
    excelRow.getCell(1).numFmt = 'dd.mm.yyyy';
    excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    amountFormat(excelRow.getCell(3));
    excelRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    excelRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
  });
  paymentsSheet.autoFilter = { from: 'A4', to: 'E' + (4 + Math.max(paymentRows.length, 1)) };

  return workbook;
}

function fileNameForExcel(kind, value, extra) {
  if (kind === 'annual') return `vedat-gayrimenkul-${value}-yillik.xlsx`;
  if (kind === 'month') return `vedat-gayrimenkul-${value}-${String(extra).padStart(2, '0')}-aylik.xlsx`;
  return `vedat-gayrimenkul-${value}.xlsx`;
}

module.exports = { buildAnnualPaymentsWorkbook, buildMonthPaymentsWorkbook, fileNameForExcel };
