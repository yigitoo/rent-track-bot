const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Expense = require('../models/expense');
const Recurrence = require('../models/recurrence');
const Tenant = require('../models/tenant');
const { requireWebAuth } = require('../utils/webAuth');
const { materializeDue, serializeRecurrence } = require('../services/recurrence');
const { categoryLabel } = require('../utils/categories');

function parseInput(body = {}) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 120) throw new Error('Başlık 1-120 karakter olmalı.');

  const amount = Number(String(body.amount ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Tutar pozitif olmalı.');

  const dayOfMonth = Number(body.dayOfMonth);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error('Ayın günü 1-31 arasında olmalı.');
  }

  const category = Expense.CATEGORIES.includes(body.category) ? body.category : 'aidat';

  const startDate = body.startDate ? new Date(body.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw new Error('Geçersiz başlangıç tarihi.');

  let endDate = null;
  if (body.endDate) {
    endDate = new Date(body.endDate);
    if (Number.isNaN(endDate.getTime())) throw new Error('Geçersiz bitiş tarihi.');
    if (endDate < startDate) throw new Error('Bitiş tarihi başlangıçtan önce olamaz.');
  }

  return {
    title,
    unit: String(body.unit || '').trim().slice(0, 60),
    category,
    amount,
    dayOfMonth,
    startDate,
    endDate,
    note: String(body.note || '').trim().slice(0, 240),
  };
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      const items = await Recurrence.find().sort({ dayOfMonth: 1 }).populate('tenant', 'name');
      return res.status(200).json({
        recurrences: items.map(serializeRecurrence),
        categories: Expense.CATEGORIES.map((value) => ({ value, label: categoryLabel(value) })),
      });
    }

    if (req.method === 'POST') {
      const input = parseInput(req.body);
      let tenant = null;
      const tenantId = String(req.body?.tenantId || '').trim();
      if (tenantId) {
        if (!mongoose.isValidObjectId(tenantId)) return res.status(400).json({ error: 'Geçersiz kiracı.' });
        tenant = await Tenant.findById(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Kiracı bulunamadı.' });
      }

      const recurrence = await Recurrence.create({ ...input, tenant: tenant?._id || null });
      const populated = await recurrence.populate('tenant', 'name');
      const processed = await materializeDue();
      return res.status(201).json({
        recurrence: serializeRecurrence(populated),
        materialized: processed.created,
      });
    }

    const id = String(req.query.id || req.body?.id || '').trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Geçersiz kayıt kimliği.' });
    }
    const recurrence = await Recurrence.findById(id);
    if (!recurrence) return res.status(404).json({ error: 'Düzenli kalem bulunamadı.' });

    if (req.method === 'PATCH') {
      recurrence.isActive = !recurrence.isActive;
      await recurrence.save();
      return res.status(200).json({ recurrence: serializeRecurrence(recurrence) });
    }

    if (req.method === 'PUT') {
      const input = parseInput(req.body);
      const tenantId = String(req.body?.tenantId || '').trim();
      let tenant = null;
      if (tenantId) {
        if (!mongoose.isValidObjectId(tenantId)) return res.status(400).json({ error: 'Geçersiz kiracı.' });
        tenant = await Tenant.findById(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Kiracı bulunamadı.' });
      }
      Object.assign(recurrence, input, { tenant: tenant?._id || null });
      await recurrence.save();
      const updated = await recurrence.populate('tenant', 'name');
      return res.status(200).json({ recurrence: serializeRecurrence(updated) });
    }

    await recurrence.deleteOne();
    return res.status(200).json({ ok: true, id });
  } catch (error) {
    console.error('Recurrences API error:', error);
    const status = /olmalı|Geçersiz|olamaz/.test(error.message || '') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Düzenli kalem işlemi başarısız.' });
  }
};
