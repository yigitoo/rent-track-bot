const { formatMonthYear, now } = require('./format');
const { MONTH_SHORT } = require('./reports');

/* Aidat takibi. Bir "aidat kalemi" kategorisi aidat olan düzenli giderdir;
   bir ayın ödendiği, o döneme ait gider kaydının ödendi işaretli olmasıdır.
   Böylece aidat ayrı bir defter tutmaz: giderlere, takvime ve raporlara
   kendiliğinden akar. */

function dueDateFor(item, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(Number(item.dayOfMonth) || 1, 1), daysInMonth);
  return new Date(year, month - 1, day, 12);
}

function coversPeriod(item, month, year) {
  const due = dueDateFor(item, month, year);
  if (item.startDate && due < new Date(item.startDate)) return false;
  if (item.endDate && due > new Date(item.endDate)) return false;
  return true;
}

function cellStatus({ covered, paid, recorded, daysUntilDue }) {
  if (!covered) return 'outside';
  if (paid) return 'paid';
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 7) return 'upcoming';
  return 'future';
}

function buildDuesYearGrid({ year, recurrences, expenses, reference = now().toDate() }) {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  const byCell = new Map();
  for (const expense of expenses) {
    if (expense.year !== year || !expense.recurrence) continue;
    byCell.set(expense.recurrence.toString() + ':' + expense.month, expense);
  }

  const ordered = [...recurrences].sort((a, b) => {
    const left = (a.unit || '').trim();
    const right = (b.unit || '').trim();
    if (left && right && left !== right) return left.localeCompare(right, 'tr', { numeric: true });
    if (left && !right) return -1;
    if (!left && right) return 1;
    return (a.title || '').localeCompare(b.title || '', 'tr');
  });

  const rows = ordered.map((item) => {
    const id = item._id.toString();

    const months = Array.from({ length: 12 }, (unused, index) => {
      const month = index + 1;
      const covered = coversPeriod(item, month, year);
      const expense = byCell.get(id + ':' + month) || null;
      const dueDate = dueDateFor(item, month, year);
      const dueDay = new Date(dueDate);
      dueDay.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((dueDay - today) / 86400000);
      const paid = Boolean(expense?.paid);

      return {
        month,
        label: MONTH_SHORT[index],
        covered,
        recorded: Boolean(expense),
        paid,
        amount: expense ? expense.amount : item.amount,
        expenseId: expense ? expense._id.toString() : '',
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        daysOverdue: -daysUntilDue,
        status: cellStatus({ covered, paid, recorded: Boolean(expense), daysUntilDue }),
      };
    });

    const expected = months.reduce((sum, cell) => sum + (cell.covered ? cell.amount : 0), 0);
    const settled = months.reduce((sum, cell) => sum + (cell.paid ? cell.amount : 0), 0);

    return {
      dueId: id,
      title: item.title,
      unit: item.unit || '',
      label: item.unit || item.title,
      amount: item.amount,
      dayOfMonth: item.dayOfMonth,
      tenantId: item.tenant?._id?.toString() || item.tenant?.toString() || '',
      tenantName: item.tenant?.name || '',
      note: item.note || '',
      isActive: item.isActive !== false,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      months,
      paidMonths: months.filter((cell) => cell.paid).length,
      openMonths: months.filter((cell) => cell.status === 'overdue').length,
      expected,
      settled,
      outstanding: Math.max(expected - settled, 0),
      rate: expected ? Math.min(Math.round((settled / expected) * 100), 100) : 0,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      expected: acc.expected + row.expected,
      settled: acc.settled + row.settled,
      paidMonths: acc.paidMonths + row.paidMonths,
      openMonths: acc.openMonths + row.openMonths,
    }),
    { expected: 0, settled: 0, paidMonths: 0, openMonths: 0 }
  );

  return {
    year,
    monthLabels: MONTH_SHORT,
    currentMonth: year === currentYear ? today.getMonth() + 1 : null,
    rows,
    totals: {
      ...totals,
      dueCount: rows.length,
      outstanding: Math.max(totals.expected - totals.settled, 0),
      rate: totals.expected ? Math.min(Math.round((totals.settled / totals.expected) * 100), 100) : 0,
    },
  };
}

/* Tek dönemin aidat özeti: aylık rapor ve panel için. */
function buildDuesPeriod({ month, year, recurrences, expenses, reference = now().toDate() }) {
  const grid = buildDuesYearGrid({ year, recurrences, expenses, reference });
  const rows = grid.rows
    .map((row) => ({
      dueId: row.dueId,
      title: row.title,
      unit: row.unit,
      label: row.label,
      tenantName: row.tenantName,
      dayOfMonth: row.dayOfMonth,
      ...row.months[month - 1],
    }))
    .filter((row) => row.covered);

  const expected = rows.reduce((sum, row) => sum + row.amount, 0);
  const settled = rows.filter((row) => row.paid).reduce((sum, row) => sum + row.amount, 0);

  return {
    month,
    year,
    label: formatMonthYear(month, year),
    rows,
    totals: {
      dueCount: rows.length,
      paidCount: rows.filter((row) => row.paid).length,
      overdueCount: rows.filter((row) => row.status === 'overdue').length,
      expected,
      settled,
      outstanding: Math.max(expected - settled, 0),
      rate: expected ? Math.min(Math.round((settled / expected) * 100), 100) : 0,
    },
  };
}

module.exports = { buildDuesPeriod, buildDuesYearGrid, coversPeriod, dueDateFor };
