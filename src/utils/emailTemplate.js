const { formatCurrency, formatDate, formatMonthYear } = require('./format');

function buildReportHtml({ month, year, tenants, paymentsByTenant, totalExpected, totalReceived }) {
  const paidList = [];
  const unpaidList = [];

  for (const tenant of tenants) {
    const tid = tenant._id.toString();
    const payments = paymentsByTenant[tid];
    if (payments && payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const lastDate = payments.sort((a, b) => b.date - a.date)[0].date;
      const partial = totalPaid < tenant.rentAmount;
      paidList.push({ tenant, totalPaid, lastDate, partial });
    } else {
      unpaidList.push(tenant);
    }
  }

  const collectionRate = tenants.length > 0
    ? Math.round((paidList.length / tenants.length) * 100)
    : 0;

  const outstanding = totalExpected - totalReceived;

  const paidRows = paidList.map((p) => {
    const statusBadge = p.partial
      ? `<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">EKSİK</span>`
      : `<span style="background:#10b981;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">ÖDENDİ</span>`;
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">${p.tenant.name}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${p.tenant.address}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${formatCurrency(p.totalPaid)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:center;">${statusBadge}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${formatDate(p.lastDate)}</td>
      </tr>`;
  }).join('');

  const unpaidRows = unpaidList.map((t) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">${t.name}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${t.address}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${formatCurrency(t.rentAmount)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:center;">
          <span style="background:#ef4444;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">ÖDENMEDİ</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">—</td>
      </tr>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">🏠 Kira Takip Raporu</h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:15px;">${formatMonthYear(month, year)}</p>
    </div>

    <!-- Stats Cards -->
    <div style="background:#fff;padding:24px 32px;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:8px;">
            <div style="background:#f0fdf4;border-radius:12px;padding:16px;">
              <div style="color:#16a34a;font-size:24px;font-weight:700;">${formatCurrency(totalReceived)}</div>
              <div style="color:#15803d;font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Toplanan</div>
            </div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="background:#fef2f2;border-radius:12px;padding:16px;">
              <div style="color:#dc2626;font-size:24px;font-weight:700;">${formatCurrency(outstanding)}</div>
              <div style="color:#991b1b;font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Kalan</div>
            </div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="background:#eff6ff;border-radius:12px;padding:16px;">
              <div style="color:#2563eb;font-size:24px;font-weight:700;">${formatCurrency(totalExpected)}</div>
              <div style="color:#1e40af;font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">Beklenen</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Progress Bar -->
    <div style="background:#fff;padding:16px 32px 24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#64748b;font-size:13px;">Tahsilat Oranı</span>
        <span style="color:#1e293b;font-size:13px;font-weight:600;">${collectionRate}%</span>
      </div>
      <div style="background:#e2e8f0;border-radius:8px;height:12px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#10b981,#34d399);height:100%;width:${collectionRate}%;border-radius:8px;"></div>
      </div>
      <div style="margin-top:8px;color:#94a3b8;font-size:12px;">${paidList.length} / ${tenants.length} kiracı ödedi</div>
    </div>

    <!-- Tenant Table -->
    <div style="background:#fff;padding:0 0 8px;border-radius:0 0 16px 16px;overflow:hidden;">
      <div style="padding:20px 32px 12px;">
        <h2 style="margin:0;color:#1e293b;font-size:16px;font-weight:600;">Kiracı Detayları</h2>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e293b;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Kiracı</th>
            <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Adres</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Tutar</th>
            <th style="padding:10px 16px;text-align:center;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Durum</th>
            <th style="padding:10px 16px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Tarih</th>
          </tr>
        </thead>
        <tbody>
          ${paidRows}${unpaidRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0 8px;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">Kira Takip Botu tarafından otomatik oluşturuldu</p>
    </div>

  </div>
</body>
</html>`;
}

module.exports = { buildReportHtml };
