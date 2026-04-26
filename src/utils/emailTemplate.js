const dayjs = require('dayjs');
const { formatCurrency, formatDate, formatMonthYear, now } = require('./format');
const { getMonthlyStatuses } = require('./rentSchedule');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusLabel(item) {
  if (item.paid) return { text: 'Ödendi', bg: '#dcfce7', color: '#166534' };
  if (item.partial) return { text: 'Eksik', bg: '#fef3c7', color: '#92400e' };
  if (item.daysUntilDue < 0) return { text: 'Gecikti', bg: '#fee2e2', color: '#991b1b' };
  if (item.daysUntilDue <= 7) return { text: 'Yaklaşıyor', bg: '#dbeafe', color: '#1d4ed8' };
  return { text: 'Ödenecek', bg: '#f1f5f9', color: '#334155' };
}

function buildBadge(item) {
  const label = statusLabel(item);
  return `<span style="display:inline-block;background:${label.bg};color:${label.color};padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;">${label.text}</span>`;
}

function sameMonth(date, month, year) {
  const d = dayjs(date);
  return d.month() + 1 === month && d.year() === year;
}

function buildCalendar(month, year, statuses) {
  const firstDay = dayjs().year(year).month(month - 1).date(1);
  const daysInMonth = firstDay.daysInMonth();
  const leadingDays = (firstDay.day() + 6) % 7;
  const eventMap = {};

  for (const item of statuses) {
    if (item.paid && item.lastDate && sameMonth(item.lastDate, month, year)) {
      const day = dayjs(item.lastDate).date();
      if (!eventMap[day]) eventMap[day] = { paid: 0, upcoming: 0, pending: 0, overdue: 0 };
      eventMap[day].paid += 1;
      continue;
    }

    if (!item.paid && sameMonth(item.dueDate, month, year)) {
      const day = dayjs(item.dueDate).date();
      if (!eventMap[day]) eventMap[day] = { paid: 0, upcoming: 0, pending: 0, overdue: 0 };
      if (item.daysUntilDue < 0) eventMap[day].overdue += 1;
      else if (item.daysUntilDue <= 7) eventMap[day].upcoming += 1;
      else eventMap[day].pending += 1;
    }
  }

  const cells = [];
  for (let i = 0; i < leadingDays; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const header = weekdays.map((day) =>
    `<th style="padding:8px 4px;color:#64748b;font-size:11px;font-weight:700;text-align:center;">${day}</th>`
  ).join('');

  const rows = weeks.map((week) => `
    <tr>
      ${week.map((day) => {
        if (!day) return '<td style="padding:4px;"><div style="height:62px;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;"></div></td>';
        const events = eventMap[day] || {};
        const chips = [
          events.paid ? `<span style="display:inline-block;margin:2px 2px 0 0;background:#16a34a;color:#fff;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700;">${events.paid}</span>` : '',
          events.upcoming ? `<span style="display:inline-block;margin:2px 2px 0 0;background:#2563eb;color:#fff;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700;">${events.upcoming}</span>` : '',
          events.pending ? `<span style="display:inline-block;margin:2px 2px 0 0;background:#94a3b8;color:#fff;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700;">${events.pending}</span>` : '',
          events.overdue ? `<span style="display:inline-block;margin:2px 2px 0 0;background:#dc2626;color:#fff;border-radius:999px;padding:2px 6px;font-size:10px;font-weight:700;">${events.overdue}</span>` : '',
        ].join('');
        return `
          <td style="padding:4px;vertical-align:top;">
            <div style="height:62px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:7px;box-sizing:border-box;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;">${day}</div>
              <div style="line-height:1.1;">${chips}</div>
            </div>
          </td>`;
      }).join('')}
    </tr>`
  ).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border-spacing:0;">
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildRows(statuses) {
  return statuses.map((item) => {
    const dueMeta = item.isDeferred
      ? `<div style="color:#92400e;font-size:12px;margin-top:4px;">Ertelendi${item.defermentNote ? `: ${escapeHtml(item.defermentNote)}` : ''}</div>`
      : '';
    const paidMeta = item.lastDate ? `<div style="color:#64748b;font-size:12px;margin-top:4px;">Ödeme: ${formatDate(item.lastDate)}</div>` : '';

    return `
      <tr>
        <td class="stack-cell" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <div style="font-weight:800;color:#0f172a;">${escapeHtml(item.tenant.name)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:4px;">${escapeHtml(item.tenant.address)}</div>
        </td>
        <td class="stack-cell" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#334155;">
          <div style="font-weight:700;">${formatDate(item.dueDate)}</div>
          ${dueMeta}
        </td>
        <td class="stack-cell amount-cell" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right;">
          <div style="font-weight:800;color:#0f172a;">${formatCurrency(item.expected)}</div>
          <div style="color:#64748b;font-size:12px;margin-top:4px;">Kalan: ${formatCurrency(item.remaining)}</div>
          ${paidMeta}
        </td>
        <td class="stack-cell status-cell" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:center;">${buildBadge(item)}</td>
      </tr>`;
  }).join('');
}

function buildMiniList(title, items, emptyText) {
  const rows = items.length
    ? items.map((item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef2f7;">
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(item.tenant.name)}</div>
          <div style="font-size:12px;color:#64748b;">${formatDate(item.dueDate)} · ${formatCurrency(item.remaining)}</div>
        </td>
      </tr>`).join('')
    : `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">${emptyText}</td></tr>`;

  return `
    <td class="summary-column" width="33.33%" style="padding:0 8px;vertical-align:top;">
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;">
        <div style="font-size:13px;font-weight:900;color:#0f172a;margin-bottom:6px;">${title}</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
      </div>
    </td>`;
}

function buildReportHtml({ month, year, tenants, paymentsByTenant, totalExpected, totalReceived }) {
  const statuses = getMonthlyStatuses(tenants, paymentsByTenant, month, year);
  const paidList = statuses.filter((item) => item.paid);
  const unpaidList = statuses.filter((item) => !item.paid);
  const overdueList = unpaidList.filter((item) => item.daysUntilDue < 0);
  const upcomingList = unpaidList.filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7);
  const pendingList = unpaidList.filter((item) => item.daysUntilDue > 7);
  const collectionRate = tenants.length > 0 ? Math.round((paidList.length / tenants.length) * 100) : 0;
  const outstanding = Math.max(totalExpected - totalReceived, 0);
  const generatedAt = formatDate(now().toDate());

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 12px !important; }
      .panel { border-radius: 14px !important; }
      .header { padding: 24px 18px !important; }
      .stat-cell, .summary-column { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 6px 0 !important; }
      .tenant-table thead { display: none !important; }
      .tenant-table tr { display: block !important; border-bottom: 1px solid #e2e8f0 !important; padding: 10px 0 !important; }
      .tenant-table td { display: block !important; border-bottom: 0 !important; padding: 5px 16px !important; text-align: left !important; }
      .amount-cell, .status-cell { text-align: left !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <div class="container" style="max-width:760px;margin:0 auto;padding:24px 16px;">
    <div class="panel" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.10);">
      <div class="header" style="background:#0f172a;padding:30px 32px;">
        <div style="color:#bfdbfe;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Kira Takip Raporu</div>
        <h1 style="margin:8px 0 0;color:#fff;font-size:26px;line-height:1.2;font-weight:900;">${formatMonthYear(month, year)}</h1>
        <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">Oluşturma tarihi: ${generatedAt}</p>
      </div>

      <div style="padding:22px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td class="stat-cell" width="25%" style="padding:6px;">
              <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:14px;">
                <div style="color:#166534;font-size:21px;font-weight:900;">${formatCurrency(totalReceived)}</div>
                <div style="color:#15803d;font-size:11px;font-weight:800;margin-top:4px;text-transform:uppercase;">Toplanan</div>
              </div>
            </td>
            <td class="stat-cell" width="25%" style="padding:6px;">
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px;">
                <div style="color:#c2410c;font-size:21px;font-weight:900;">${formatCurrency(outstanding)}</div>
                <div style="color:#9a3412;font-size:11px;font-weight:800;margin-top:4px;text-transform:uppercase;">Kalan</div>
              </div>
            </td>
            <td class="stat-cell" width="25%" style="padding:6px;">
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;">
                <div style="color:#1d4ed8;font-size:21px;font-weight:900;">${formatCurrency(totalExpected)}</div>
                <div style="color:#1e40af;font-size:11px;font-weight:800;margin-top:4px;text-transform:uppercase;">Beklenen</div>
              </div>
            </td>
            <td class="stat-cell" width="25%" style="padding:6px;">
              <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;padding:14px;">
                <div style="color:#334155;font-size:21px;font-weight:900;">${collectionRate}%</div>
                <div style="color:#475569;font-size:11px;font-weight:800;margin-top:4px;text-transform:uppercase;">Tahsilat</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:24px;">
        <h2 style="margin:0 0 14px;font-size:17px;font-weight:900;color:#0f172a;">Aylık Takvim</h2>
        <div style="border:1px solid #e2e8f0;border-radius:14px;padding:10px;background:#f8fafc;">
          ${buildCalendar(month, year, statuses)}
        </div>
        <div style="margin-top:10px;color:#64748b;font-size:12px;">
          <span style="color:#16a34a;font-weight:800;">Yeşil</span>: ödendi ·
          <span style="color:#2563eb;font-weight:800;">Mavi</span>: yaklaşıyor ·
          <span style="color:#64748b;font-weight:800;">Gri</span>: ödenecek ·
          <span style="color:#dc2626;font-weight:800;">Kırmızı</span>: gecikti
        </div>
      </div>

      <div style="padding:0 16px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            ${buildMiniList('Ödendi', paidList.slice(0, 5), 'Bu ay ödeme yok.')}
            ${buildMiniList('Yaklaşan', upcomingList.slice(0, 5), '7 gün içinde ödeme yok.')}
            ${buildMiniList('Bekleyen', [...overdueList, ...pendingList].slice(0, 5), 'Bekleyen ödeme yok.')}
          </tr>
        </table>
      </div>

      <div style="padding:0 24px 28px;">
        <h2 style="margin:0 0 12px;font-size:17px;font-weight:900;color:#0f172a;">Kiracı Detayları</h2>
        <table class="tenant-table" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;font-size:14px;border-collapse:separate;border-spacing:0;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:11px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Kiracı</th>
              <th style="padding:11px 16px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Son Ödeme</th>
              <th style="padding:11px 16px;text-align:right;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Tutar</th>
              <th style="padding:11px 16px;text-align:center;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Durum</th>
            </tr>
          </thead>
          <tbody>${buildRows(statuses)}</tbody>
        </table>
      </div>
    </div>

    <div style="text-align:center;padding:18px 0 6px;color:#94a3b8;font-size:12px;">Kira Takip Botu tarafından otomatik oluşturuldu</div>
  </div>
</body>
</html>`;
}

module.exports = { buildReportHtml };
