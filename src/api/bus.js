const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Bus = require('../models/bus');
const { requireWebAuth } = require('../utils/webAuth');
const { now } = require('../utils/format');
const {
  deleteDay,
  listBuses,
  loadMonth,
  monthReport,
  rangeReport,
  saveBus,
  saveDay,
} = require('../services/bus');
const { sendOwnerNotification } = require('../services/notificationService');
const { formatCurrency, formatDate } = require('../utils/format');

function parseYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now().year();
}

function parseMonth(value) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : now().month() + 1;
}

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    const scope = String(req.query.scope || 'month');

    if (req.method === 'GET') {
      if (scope === 'buses') return res.status(200).json({ buses: await listBuses() });
      if (scope === 'report') {
        return res.status(200).json(await monthReport({
          month: parseMonth(req.query.month),
          year: parseYear(req.query.year),
          busId: String(req.query.busId || ''),
        }));
      }
      if (scope === 'range') {
        const requested = Number(req.query.months);
        const months = Number.isInteger(requested) && requested >= 3 && requested <= 24 ? requested : 12;
        return res.status(200).json(await rangeReport(months));
      }
      return res.status(200).json(await loadMonth({
        month: parseMonth(req.query.month),
        year: parseYear(req.query.year),
        busId: String(req.query.busId || ''),
      }));
    }

    if (req.method === 'PUT') {
      const id = String(req.query.id || '').trim();
      if (id && !mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Geçersiz araç.' });
      return res.status(200).json({ bus: await saveBus(req.body || {}, id) });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').trim();
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Geçersiz kayıt.' });

      if (scope === 'bus') {
        const bus = await Bus.findById(id);
        if (!bus) return res.status(404).json({ error: 'Araç bulunamadı.' });
        bus.isActive = false;
        await bus.save();
        return res.status(200).json({ ok: true, id });
      }

      const snapshot = await deleteDay(id);
      return res.status(200).json({ entry: snapshot });
    }

    if (scope === 'bus') {
      return res.status(201).json({ bus: await saveBus(req.body || {}) });
    }

    const result = await saveDay({ ...(req.body || {}), source: 'web' });
    const gun = result.entry;
    await sendOwnerNotification({
      type: 'bus_day',
      title: 'Otobüs günlüğü kaydedildi',
      message: [
        '🚌 ' + (result.created ? 'Gün kaydedildi' : 'Gün güncellendi'),
        '',
        'Araç no: ' + result.bus.number + (result.bus.label ? ' · ' + result.bus.label : ''),
        'Tarih: ' + formatDate(gun.date),
        'Toplam: ' + formatCurrency(gun.gross),
        'Mazot: ' + formatCurrency(gun.fuel),
        'Yövmiye: ' + formatCurrency(gun.wage),
        'Denekçi: ' + formatCurrency(gun.fee),
        gun.other ? 'Diğer: ' + formatCurrency(gun.other) + (gun.otherNote ? ' (' + gun.otherNote + ')' : '') : '',
        'Kalan: ' + formatCurrency(gun.net),
      ].filter(Boolean).join('\n'),
      metadata: { busId: gun.busId, day: gun.day, month: gun.month, year: gun.year },
    });

    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    console.error('Bus API error:', error);
    const status = /olmalı|Geçersiz|bulunamadı|zaten|seçilmedi|en az|en fazla|okunamadı/.test(error.message || '')
      ? 400
      : 500;
    return res.status(status).json({ error: error.message || 'Otobüs işlemi başarısız.' });
  }
};
