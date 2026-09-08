const Expense = require('../models/expense');
const Recurrence = require('../models/recurrence');
const { now } = require('../utils/format');

function serializeRecurrence(item) {
  return {
    id: item._id.toString(),
    title: item.title,
    unit: item.unit || '',
    category: item.category,
    amount: item.amount,
    dayOfMonth: item.dayOfMonth,
    tenantId: item.tenant?._id?.toString() || item.tenant?.toString() || '',
    tenantName: item.tenant?.name || '',
    note: item.note || '',
    startDate: item.startDate ? new Date(item.startDate).toISOString() : null,
    endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
    isActive: item.isActive,
  };
}

function dueDateFor(recurrence, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(recurrence.dayOfMonth, daysInMonth);
  return new Date(year, month - 1, day, 12);
}

function coversPeriod(recurrence, month, year) {
  const due = dueDateFor(recurrence, month, year);
  if (recurrence.startDate && due < new Date(recurrence.startDate)) return false;
  if (recurrence.endDate && due > new Date(recurrence.endDate)) return false;
  return true;
}

/* Günü gelmiş düzenli kalemleri gerçek gider kaydına çevirir.
   Aynı dönem iki kez işlenmez: benzersiz dizin çift kaydı reddeder. */
async function materializeDue(reference = now().toDate()) {
  const today = new Date(reference);
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const recurrences = await Recurrence.find({ isActive: true });
  const created = [];

  for (const recurrence of recurrences) {
    if (!coversPeriod(recurrence, month, year)) continue;
    const due = dueDateFor(recurrence, month, year);
    if (due > today) continue;

    const exists = await Expense.exists({ recurrence: recurrence._id, month, year });
    if (exists) continue;

    try {
      const expense = await Expense.create({
        title: recurrence.title,
        category: recurrence.category,
        amount: recurrence.amount,
        date: due,
        month,
        year,
        tenant: recurrence.tenant || null,
        recurrence: recurrence._id,
        note: recurrence.note,
        paid: false,
        paidAt: null,
      });
      created.push(expense);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  return { created: created.length, month, year };
}

/* Bir dönemde henüz gerçekleşmemiş planlı kalemler: takvimde hayalet olarak. */
async function plannedFor(month, year) {
  const recurrences = await Recurrence.find({ isActive: true }).populate('tenant', 'name');
  const active = recurrences.filter((item) => coversPeriod(item, month, year));
  if (!active.length) return [];

  const materialized = await Expense.find({
    recurrence: { $in: active.map((item) => item._id) },
    month,
    year,
  }).select('recurrence');
  const done = new Set(materialized.map((item) => item.recurrence.toString()));

  return active
    .filter((item) => !done.has(item._id.toString()))
    .map((item) => ({
      ...serializeRecurrence(item),
      dueDate: dueDateFor(item, month, year).toISOString(),
    }));
}

module.exports = { dueDateFor, materializeDue, plannedFor, serializeRecurrence };
