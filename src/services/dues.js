const Expense = require('../models/expense');
const Recurrence = require('../models/recurrence');
const { now } = require('../utils/format');
const { buildDuesPeriod, buildDuesYearGrid, dueDateFor } = require('../utils/dues');
const { notifyDueSettled, notifyDueReopened } = require('./notificationService');

/* Aidat kalemi = kategorisi "aidat" olan düzenli gider. Panel ve bot bu
   servisi çağırır; ikisi de aynı gider kaydını yazar. */

const CATEGORY = 'aidat';

function normalizePeriod(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('Geçersiz ay.');
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Geçersiz yıl.');
  return { month: m, year: y };
}

function dueFilter() {
  return { category: CATEGORY };
}

async function findDue(dueId) {
  const due = await Recurrence.findOne({ _id: dueId, category: CATEGORY });
  if (!due) throw new Error('Aidat kalemi bulunamadı.');
  return due;
}

async function loadDues() {
  return Recurrence.find(dueFilter()).sort({ dayOfMonth: 1, title: 1 }).populate('tenant', 'name');
}

async function loadYearGrid(year) {
  const [recurrences, expenses] = await Promise.all([
    loadDues(),
    Expense.find({ year, category: CATEGORY, recurrence: { $ne: null } }),
  ]);
  return buildDuesYearGrid({ year, recurrences, expenses });
}

async function loadPeriod(month, year) {
  const [recurrences, expenses] = await Promise.all([
    loadDues(),
    Expense.find({ year, category: CATEGORY, recurrence: { $ne: null } }),
  ]);
  return buildDuesPeriod({ month, year, recurrences, expenses });
}

/* Kutucuk işaretlendi: dönemin gider kaydı yoksa açılır, varsa ödendi
   işaretlenir. Aynı dönem için ikinci kayıt açılmaz (benzersiz dizin). */
async function markDuePaid({ dueId, month, year, source = 'web' }) {
  const period = normalizePeriod(month, year);
  const due = await findDue(dueId);
  const date = dueDateFor(due, period.month, period.year);

  let expense = await Expense.findOne({ recurrence: due._id, month: period.month, year: period.year });
  if (expense && expense.paid) {
    return { due, expense, skipped: true, reason: 'already_paid', ...period };
  }

  if (expense) {
    expense.paid = true;
    expense.paidAt = now().toDate();
    await expense.save();
  } else {
    try {
      expense = await Expense.create({
        title: due.title,
        category: CATEGORY,
        amount: due.amount,
        date,
        month: period.month,
        year: period.year,
        tenant: due.tenant || null,
        recurrence: due._id,
        note: due.note,
        paid: true,
        paidAt: now().toDate(),
      });
    } catch (error) {
      // Zamanlanmış iş aynı anda kalemi yükümlülüğe çevirmiş olabilir;
      // benzersiz dizin ikinci kaydı reddeder, var olanı işaretleriz.
      if (error.code !== 11000) throw error;
      expense = await Expense.findOne({ recurrence: due._id, month: period.month, year: period.year });
      if (!expense) throw error;
      expense.paid = true;
      expense.paidAt = now().toDate();
      await expense.save();
    }
  }

  const notification = await notifyDueSettled(due, { ...period, amount: expense.amount, source });
  return { due, expense, skipped: false, notification, ...period };
}

/* İşaret kaldırıldı: yükümlülük duruyor, yalnız ödendi bilgisi düşüyor.
   Kayıt silinmez; aidat borcu kaybolmasın. */
async function unmarkDue({ dueId, month, year, source = 'web' }) {
  const period = normalizePeriod(month, year);
  const due = await findDue(dueId);
  const expense = await Expense.findOne({ recurrence: due._id, month: period.month, year: period.year });

  if (!expense || !expense.paid) {
    return { due, skipped: true, reason: 'not_marked', ...period };
  }

  expense.paid = false;
  expense.paidAt = null;
  await expense.save();

  const notification = await notifyDueReopened(due, { ...period, amount: expense.amount, source });
  return { due, expense, skipped: false, notification, ...period };
}

async function toggleDue({ dueId, month, year, source = 'web' }) {
  const period = normalizePeriod(month, year);
  const due = await findDue(dueId);
  const expense = await Expense.findOne({ recurrence: due._id, month: period.month, year: period.year });

  if (expense?.paid) {
    const result = await unmarkDue({ dueId, ...period, source });
    return { ...result, action: 'unmarked' };
  }
  const result = await markDuePaid({ dueId, ...period, source });
  return { ...result, action: 'marked' };
}

module.exports = { CATEGORY, loadPeriod, loadYearGrid, markDuePaid, toggleDue, unmarkDue };
