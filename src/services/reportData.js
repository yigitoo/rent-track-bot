const Tenant = require('../models/tenant');
const Payment = require('../models/payment');
const Expense = require('../models/expense');
const Recurrence = require('../models/recurrence');
const { formatMonthYear } = require('../utils/format');
const { categoryLabel } = require('../utils/categories');
const { buildDuesPeriod, buildDuesYearGrid } = require('../utils/dues');
const {
  buildAgenda,
  buildAnnual,
  buildCategoryBreakdown,
  buildSeries,
  buildTenantBreakdown,
  buildYearGrid,
  monthKeys,
} = require('../utils/reports');

/* Rapor verisi tek yerde toplanır: web API'si de Telegram botu da aynı
   nesneyi alır, böylece PDF ile ekran hiçbir zaman ayrışmaz. */

async function loadDueItems() {
  return Recurrence.find({ category: 'aidat' }).sort({ dayOfMonth: 1, title: 1 }).populate('tenant', 'name');
}

async function monthReport(month, year) {
  const [tenants, payments, expenses, dueItems] = await Promise.all([
    Tenant.find({ isActive: true }).sort({ name: 1 }),
    Payment.find({ month, year }).sort({ date: 1 }),
    Expense.find({ month, year }).sort({ date: 1 }).populate('tenant', 'name'),
    loadDueItems(),
  ]);

  /* Arşivlenmiş bir kiracı o dönemde ödeme yapmış olabilir. Tabloda kalmazsa
     tahsilat toplamı satırlarla uyuşmaz; beklenene katılmaz ama görünür. */
  const activeIds = new Set(tenants.map((tenant) => tenant._id.toString()));
  const missingIds = Array.from(new Set(payments.map((item) => item.tenant.toString())))
    .filter((id) => !activeIds.has(id));
  const archived = missingIds.length ? await Tenant.find({ _id: { $in: missingIds } }) : [];

  const grid = buildYearGrid({ year, tenants: [...tenants, ...archived], payments });
  const rows = grid.rows.map((row) => {
    const cell = row.months[month - 1];
    const isArchived = !activeIds.has(row.tenantId);
    return {
      tenantId: row.tenantId,
      name: row.name,
      address: row.address,
      paymentDay: row.paymentDay,
      archived: isArchived,
      expected: isArchived || !cell.inside ? 0 : cell.expected,
      paid: cell.paid,
      remaining: isArchived || !cell.inside ? 0 : cell.remaining,
      status: isArchived ? 'archived' : cell.status,
      dueDate: cell.dueDate,
      lastDate: cell.lastDate,
      isDeferred: cell.isDeferred,
      inside: cell.inside,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const nameById = new Map([...tenants, ...archived].map((tenant) => [tenant._id.toString(), tenant.name]));
  const expected = rows.reduce((sum, row) => sum + row.expected, 0);
  const received = payments.reduce((sum, item) => sum + item.amount, 0);
  const expense = expenses.reduce((sum, item) => sum + item.amount, 0);

  return {
    scope: 'month',
    month,
    year,
    label: formatMonthYear(month, year),
    rows,
    payments: payments.map((item) => ({
      id: item._id.toString(),
      tenantName: nameById.get(item.tenant.toString()) || 'Bilinmiyor',
      amount: item.amount,
      date: item.date ? item.date.toISOString() : null,
      note: item.note || '',
      source: item.source || 'web',
    })),
    expenses: expenses.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      category: item.category,
      categoryLabel: categoryLabel(item.category),
      amount: item.amount,
      date: item.date ? item.date.toISOString() : null,
      tenantName: item.tenant?.name || '',
      paid: item.paid !== false,
    })),
    byCategory: buildCategoryBreakdown(expenses),
    dues: buildDuesPeriod({ month, year, recurrences: dueItems, expenses }),
    totals: {
      expected,
      received,
      outstanding: Math.max(expected - received, 0),
      expense,
      net: received - expense,
      rate: expected ? Math.min(Math.round((received / expected) * 100), 100) : 0,
      tenantCount: rows.length,
      paidCount: rows.filter((row) => row.status === 'paid').length,
      partialCount: rows.filter((row) => row.status === 'partial').length,
      overdueCount: rows.filter((row) => row.status === 'overdue').length,
    },
  };
}

async function annualReport(year) {
  const rangeStart = new Date(year, 0, 1);
  const rangeEnd = new Date(year + 1, 0, 1);

  const [tenants, payments, expenses, dueItems, dueExpenses] = await Promise.all([
    Tenant.find().sort({ name: 1 }),
    Payment.find({ date: { $gte: rangeStart, $lt: rangeEnd } }),
    Expense.find({ date: { $gte: rangeStart, $lt: rangeEnd } }),
    loadDueItems(),
    Expense.find({ year, category: 'aidat', recurrence: { $ne: null } }),
  ]);

  // Yıl içinde arşivlenmiş kiracılar da tabloda kalmalı; o yılın geçmişi eksilmesin.
  const relevant = tenants.filter((tenant) => {
    if (tenant.isActive) return true;
    const start = tenant.contractStart || tenant.createdAt;
    return start && new Date(start).getFullYear() <= year;
  });

  return {
    ...buildAnnual({ year, tenants: relevant, payments, expenses }),
    dues: buildDuesYearGrid({ year, recurrences: dueItems, expenses: dueExpenses }),
  };
}

async function rangeReport(monthCount) {
  const months = monthKeys(monthCount);
  const first = months[0];
  const rangeStart = new Date(first.year, first.month - 1, 1);

  const [tenants, payments, expenses] = await Promise.all([
    Tenant.find({ isActive: true }).sort({ name: 1 }),
    Payment.find({ date: { $gte: rangeStart } }),
    Expense.find({ date: { $gte: rangeStart } }),
  ]);

  const series = buildSeries({ months, tenants, payments, expenses });
  const totals = series.reduce(
    (acc, item) => ({
      expected: acc.expected + item.expected,
      received: acc.received + item.received,
      expense: acc.expense + item.expense,
      net: acc.net + item.net,
    }),
    { expected: 0, received: 0, expense: 0, net: 0 }
  );
  const best = series.reduce((top, item) => (item.received > (top?.received ?? -1) ? item : top), null);

  return {
    months: monthCount,
    series,
    byTenant: buildTenantBreakdown({ months, tenants, payments }),
    byCategory: buildCategoryBreakdown(expenses),
    agenda: buildAgenda(tenants),
    totals: {
      ...totals,
      rate: totals.expected ? Math.min(Math.round((totals.received / totals.expected) * 100), 100) : 0,
      averageMonthly: series.length ? Math.round(totals.received / series.length) : 0,
      bestMonth: best ? { label: best.label, received: best.received } : null,
      deposits: tenants.reduce((sum, tenant) => sum + (tenant.deposit || 0), 0),
      annualProjection: tenants.reduce((sum, tenant) => sum + tenant.rentAmount, 0) * 12,
    },
  };
}

module.exports = { annualReport, monthReport, rangeReport };
