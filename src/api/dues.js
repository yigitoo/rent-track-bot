const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const { requireWebAuth } = require('../utils/webAuth');
const { now } = require('../utils/format');
const { loadPeriod, loadYearGrid, markDuePaid, unmarkDue } = require('../services/dues');

function parseYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now().year();
}

function parseMonth(value) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : now().month() + 1;
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      const year = parseYear(req.query.year);
      if (String(req.query.scope || '') === 'period') {
        return res.status(200).json(await loadPeriod(parseMonth(req.query.month), year));
      }
      return res.status(200).json(await loadYearGrid(year));
    }

    const dueId = String(req.query.dueId || req.body?.dueId || '').trim();
    if (!mongoose.isValidObjectId(dueId)) {
      return res.status(400).json({ error: 'Geçersiz aidat kalemi.' });
    }

    const month = Number(req.query.month ?? req.body?.month);
    const year = Number(req.query.year ?? req.body?.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 ||
        !Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Geçersiz dönem.' });
    }

    if (req.method === 'DELETE') {
      const result = await unmarkDue({ dueId, month, year, source: 'web' });
      return res.status(200).json({ skipped: result.skipped, reason: result.reason, month, year });
    }

    const result = await markDuePaid({ dueId, month, year, source: 'web' });
    return res.status(result.skipped ? 200 : 201).json({
      skipped: result.skipped,
      reason: result.reason,
      amount: result.expense?.amount ?? 0,
      month,
      year,
    });
  } catch (error) {
    console.error('Dues API error:', error);
    const status = /Geçersiz|bulunamadı/.test(error.message || '') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Aidat işlemi başarısız.' });
  }
};
