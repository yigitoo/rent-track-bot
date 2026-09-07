const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const { now } = require('../utils/format');
const { rentAtMonth, buildYearGrid } = require('../utils/reports');
const { getTenantDueInfo } = require('../utils/rentSchedule');
const { notifyPaymentRecorded, notifyPeriodCleared } = require('./notificationService');

/* Panel ve bot aynı işlemi çağırsın diye kira dönemi işaretleme burada.
   İki arayüzden gelen kayıt tek yerde üretilir; yalnız "source" değişir. */

function normalizePeriod(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('Geçersiz ay.');
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Geçersiz yıl.');
  return { month: m, year: y };
}

/* Ödeme tarihi dönemin içinde kalmalı: takvim ve raporlar tarihe bakıyor.
   İçinde bulunduğumuz aysa bugün, değilse o dönemin son ödeme günü. */
function periodPaymentDate(tenant, month, year) {
  const today = now();
  if (today.year() === year && today.month() + 1 === month) return today.toDate();
  return new Date(getTenantDueInfo(tenant, month, year).dueDate);
}

async function findTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Kiracı bulunamadı.');
  return tenant;
}

async function periodSummary(tenant, month, year) {
  const payments = await Payment.find({ tenant: tenant._id, month, year }).sort({ date: 1 });
  const totalPaid = payments.reduce((sum, item) => sum + item.amount, 0);
  const expected = rentAtMonth(tenant, month, year);
  return {
    payments,
    totalPaid,
    expected,
    remaining: Math.max(Math.round((expected - totalPaid) * 100) / 100, 0),
    paid: expected > 0 && totalPaid >= expected,
  };
}

/* Kutucuk işaretlendi: dönemin açığı kadar tek kayıt düşer. Tam ödenmişse
   yeni kayıt açılmaz, çift tıklama tutarı ikiye katlamasın. */
async function markPeriodPaid({ tenantId, month, year, source = 'web', note = '', amount = null }) {
  const period = normalizePeriod(month, year);
  const tenant = await findTenant(tenantId);
  const summary = await periodSummary(tenant, period.month, period.year);

  const requested = amount === null || amount === undefined ? summary.remaining : Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return { tenant, skipped: true, reason: 'already_paid', ...summary, ...period };
  }

  const payment = await Payment.create({
    tenant: tenant._id,
    amount: Math.round(requested * 100) / 100,
    date: periodPaymentDate(tenant, period.month, period.year),
    month: period.month,
    year: period.year,
    note,
    source,
  });

  const notification = await notifyPaymentRecorded(payment, tenant, { source });
  return {
    tenant,
    payment,
    notification,
    skipped: false,
    expected: summary.expected,
    totalPaid: summary.totalPaid + payment.amount,
    ...period,
  };
}

/* Kutucuk kaldırıldı: o döneme ait tüm kayıtlar silinir. */
async function clearPeriod({ tenantId, month, year, source = 'web' }) {
  const period = normalizePeriod(month, year);
  const tenant = await findTenant(tenantId);
  const existing = await Payment.find({ tenant: tenant._id, month: period.month, year: period.year });

  if (!existing.length) {
    return { tenant, removed: 0, amount: 0, skipped: true, reason: 'nothing_to_clear', ...period };
  }

  const amount = existing.reduce((sum, item) => sum + item.amount, 0);
  await Payment.deleteMany({ tenant: tenant._id, month: period.month, year: period.year });
  const notification = await notifyPeriodCleared(tenant, {
    month: period.month,
    year: period.year,
    amount,
    count: existing.length,
    source,
  });

  return { tenant, removed: existing.length, amount, notification, skipped: false, ...period };
}

/* Tam ödenmişse işaret kalkar; eksikse dokunuş kalanı tamamlar. Kutucuk
   "ödendi" demek, o yüzden yarım kayıt tek dokunuşta tamamlanır. */
async function togglePeriod({ tenantId, month, year, source = 'web' }) {
  const period = normalizePeriod(month, year);
  const tenant = await findTenant(tenantId);
  const summary = await periodSummary(tenant, period.month, period.year);

  if (summary.paid) {
    const result = await clearPeriod({ tenantId, ...period, source });
    return { ...result, action: 'cleared' };
  }
  const result = await markPeriodPaid({ tenantId, ...period, source });
  return { ...result, action: 'marked' };
}

async function loadYearGrid(year) {
  const [tenants, payments] = await Promise.all([
    Tenant.find({ isActive: true }).sort({ name: 1 }),
    Payment.find({ year }),
  ]);
  return buildYearGrid({ year, tenants, payments });
}

module.exports = {
  clearPeriod,
  loadYearGrid,
  markPeriodPaid,
  periodSummary,
  togglePeriod,
};
