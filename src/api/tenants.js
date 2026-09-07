const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Tenant = require('../models/tenant');
const { requireWebAuth } = require('../utils/webAuth');
const {
  notifyRentIncreased,
  notifyTenantArchived,
  notifyTenantCreated,
  notifyTenantRestored,
  notifyTenantUpdated,
} = require('../services/notificationService');
const { serializeTenant } = require('../utils/api');

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

function optionalDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + ' geçersiz.');
  date.setHours(12, 0, 0, 0);
  return date;
}

function money(value, label, { min = 0, max = 1e9 } = {}) {
  const amount = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    throw new Error(label + ' geçersiz.');
  }
  return amount;
}

function cleanTenantInput(body = {}) {
  const name = String(body.name || '').trim();
  const address = String(body.address || '').trim();
  const rentAmount = money(body.rentAmount, 'Kira tutarı', { min: 1 });
  const paymentDay = Number(body.paymentDay);

  if (!name || name.length > 120) throw new Error('Kiracı adı 1-120 karakter olmalı.');
  if (!address || address.length > 240) throw new Error('Adres 1-240 karakter olmalı.');
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    throw new Error('Ödeme günü 1-31 arasında olmalı.');
  }

  const email = String(body.email || '').trim().slice(0, 120);
  if (email && !EMAIL_PATTERN.test(email)) throw new Error('Kiracı e-posta adresi geçersiz.');

  const increaseRate = Number(String(body.increaseRate ?? 0).replace(',', '.')) || 0;
  if (increaseRate < 0 || increaseRate > 200) throw new Error('Yıllık artış oranı 0-200 arasında olmalı.');

  const contractStart = optionalDate(body.contractStart, 'Sözleşme başlangıcı');
  const contractEnd = optionalDate(body.contractEnd, 'Sözleşme bitişi');
  if (contractStart && contractEnd && contractEnd < contractStart) {
    throw new Error('Sözleşme bitişi başlangıçtan önce olamaz.');
  }

  return {
    name,
    address,
    rentAmount,
    paymentDay,
    phone: String(body.phone || '').trim().slice(0, 32),
    email,
    deposit: body.deposit === '' || body.deposit === undefined || body.deposit === null
      ? 0
      : money(body.deposit, 'Depozito'),
    increaseRate,
    contractStart,
    contractEnd,
    notes: String(body.notes || '').trim().slice(0, 1000),
  };
}

/* Kira artışı: tutar doğrudan verilebilir ya da yüzdeden hesaplanır.
   Eski tutar rentHistory'de kalır, böylece geçmiş dönem raporları anlaşılır. */
function computeRaise(tenant, body) {
  const previousAmount = tenant.rentAmount;
  let amount;

  if (body.amount !== undefined && body.amount !== '') {
    amount = money(body.amount, 'Yeni kira tutarı', { min: 1 });
  } else {
    const rate = Number(String(body.rate ?? tenant.increaseRate ?? 0).replace(',', '.'));
    if (!Number.isFinite(rate) || rate <= 0 || rate > 200) {
      throw new Error('Artış oranı 0-200 arasında olmalı.');
    }
    amount = Math.round(previousAmount * (1 + rate / 100));
  }

  if (amount === previousAmount) throw new Error('Yeni kira tutarı eskisiyle aynı.');

  return {
    amount,
    previousAmount,
    effectiveFrom: optionalDate(body.effectiveFrom, 'Geçerlilik tarihi') || new Date(),
    note: String(body.note || '').trim().slice(0, 240),
  };
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      const includeArchived = req.query.includeArchived === 'true';
      const tenants = await Tenant.find(includeArchived ? {} : { isActive: true }).sort({ name: 1 });
      return res.status(200).json({ tenants: tenants.map(serializeTenant) });
    }

    if (req.method === 'POST') {
      const input = cleanTenantInput(req.body);
      const tenant = await Tenant.create({
        ...input,
        isActive: true,
        rentHistory: [{
          amount: input.rentAmount,
          previousAmount: 0,
          effectiveFrom: input.contractStart || new Date(),
          note: 'İlk kayıt',
        }],
      });
      const notification = await notifyTenantCreated(tenant);
      return res.status(201).json({ tenant: serializeTenant(tenant), notification });
    }

    const id = String(req.query.id || req.body?.id || '').trim();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Geçersiz kiracı kimliği.' });
    }

    const tenant = await Tenant.findById(id);
    if (!tenant) return res.status(404).json({ error: 'Kiracı bulunamadı.' });

    const action = String(req.query.action || '');

    if (req.method === 'PATCH' && action === 'restore') {
      tenant.isActive = true;
      await tenant.save();
      const notification = await notifyTenantRestored(tenant);
      return res.status(200).json({ tenant: serializeTenant(tenant), notification });
    }

    if (req.method === 'PATCH' && action === 'raise') {
      const raise = computeRaise(tenant, req.body || {});
      tenant.rentAmount = raise.amount;
      tenant.rentHistory.push(raise);
      await tenant.save();
      const notification = await notifyRentIncreased(tenant, raise);
      return res.status(200).json({ tenant: serializeTenant(tenant), notification });
    }

    if (req.method === 'DELETE') {
      tenant.isActive = false;
      await tenant.save();
      const notification = await notifyTenantArchived(tenant);
      return res.status(200).json({ tenant: serializeTenant(tenant), notification });
    }

    const updated = cleanTenantInput({ ...tenant.toObject(), ...req.body });
    const rentChanged = updated.rentAmount !== tenant.rentAmount;
    const previousAmount = tenant.rentAmount;
    Object.assign(tenant, updated);
    if (rentChanged) {
      tenant.rentHistory.push({
        amount: updated.rentAmount,
        previousAmount,
        effectiveFrom: new Date(),
        note: 'Düzenleme ile güncellendi',
      });
    }
    await tenant.save();
    const notification = await notifyTenantUpdated(tenant);
    return res.status(200).json({ tenant: serializeTenant(tenant), notification });
  } catch (error) {
    console.error('Tenants API error:', error);
    const status = error.name === 'ValidationError' || /olmalı|geçersiz|Geçersiz|olamaz|aynı/.test(error.message || '')
      ? 400
      : 500;
    return res.status(status).json({ error: error.message || 'Kiracı işlemi başarısız.' });
  }
};
