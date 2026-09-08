const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Expense = require('../models/expense');
const Tenant = require('../models/tenant');
const { requireWebAuth } = require('../utils/webAuth');
const { parsePeriod, serializeExpense } = require('../utils/api');
const { notifyExpenseDeleted, notifyExpenseRecorded } = require('../services/notificationService');
const { categoryLabel } = require('../utils/categories');
const { requireMoney } = require('../utils/money');

const CATEGORIES = Expense.CATEGORIES;

function parseExpenseInput(body = {}) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 120) throw new Error('Gider başlığı 1-120 karakter olmalı.');

  const amount = requireMoney(body.amount, 'expense');

  const category = CATEGORIES.includes(body.category) ? body.category : 'diger';

  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Geçersiz gider tarihi.');
  date.setHours(12, 0, 0, 0);

  const period = parsePeriod({
    month: body.month ?? date.getMonth() + 1,
    year: body.year ?? date.getFullYear(),
  });

  return {
    title,
    category,
    amount,
    date,
    month: period.month,
    year: period.year,
    note: String(body.note || '').trim().slice(0, 240),
  };
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      const filter = {};
      if (req.query.month && req.query.year) {
        const period = parsePeriod(req.query);
        filter.month = period.month;
        filter.year = period.year;
      } else if (req.query.year) {
        filter.year = Number(req.query.year);
      }
      const expenses = await Expense.find(filter)
        .sort({ date: -1 })
        .limit(200)
        .populate('tenant', 'name');
      return res.status(200).json({
        expenses: expenses.map(serializeExpense),
        categories: CATEGORIES.map((value) => ({ value, label: categoryLabel(value) })),
      });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || req.body?.id || '').trim();
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: 'Geçersiz gider kimliği.' });
      }
      const expense = await Expense.findById(id).populate('tenant', 'name');
      if (!expense) return res.status(404).json({ error: 'Gider bulunamadı.' });

      const snapshot = serializeExpense(expense);
      await expense.deleteOne();
      const notification = await notifyExpenseDeleted(snapshot);
      return res.status(200).json({ expense: snapshot, notification });
    }

    const input = parseExpenseInput(req.body);
    let tenant = null;
    const tenantId = String(req.body?.tenantId || '').trim();
    if (tenantId) {
      if (!mongoose.isValidObjectId(tenantId)) {
        return res.status(400).json({ error: 'Geçersiz kiracı.' });
      }
      tenant = await Tenant.findById(tenantId);
      if (!tenant) return res.status(404).json({ error: 'Kiracı bulunamadı.' });
    }

    const expense = await Expense.create({ ...input, tenant: tenant?._id || null });
    const populated = await expense.populate('tenant', 'name');
    const serialized = serializeExpense(populated);
    const notification = await notifyExpenseRecorded(serialized);

    return res.status(201).json({ expense: serialized, notification });
  } catch (error) {
    console.error('Expenses API error:', error);
    const status = /olmalı|Geçersiz/.test(error.message || '') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Gider işlemi başarısız.' });
  }
};
