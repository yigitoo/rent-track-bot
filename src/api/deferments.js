const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Tenant = require('../models/tenant');
const { requireWebAuth } = require('../utils/webAuth');
const { parsePeriod } = require('../utils/api');
const { notifyRentDeferred } = require('../services/notificationService');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    const tenantId = String(req.body?.tenantId || '').trim();
    if (!mongoose.isValidObjectId(tenantId)) {
      return res.status(400).json({ error: 'Geçersiz kiracı.' });
    }

    const tenant = await Tenant.findOne({ _id: tenantId, isActive: true });
    if (!tenant) return res.status(404).json({ error: 'Aktif kiracı bulunamadı.' });

    const { month, year } = parsePeriod(req.body);
    const dueDate = new Date(req.body?.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ error: 'Geçersiz yeni son ödeme tarihi.' });
    }
    dueDate.setHours(12, 0, 0, 0);

    const note = String(req.body?.note || '').trim().slice(0, 240);
    tenant.deferments = (tenant.deferments || []).filter((item) =>
      item.month !== month || item.year !== year
    );
    tenant.deferments.push({ month, year, dueDate, note });
    await tenant.save();

    const notification = await notifyRentDeferred(tenant, { month, year, dueDate, note });
    return res.status(200).json({
      deferment: { tenantId: tenant._id.toString(), month, year, dueDate: dueDate.toISOString(), note },
      notification,
    });
  } catch (error) {
    console.error('Deferments API error:', error);
    return res.status(400).json({ error: error.message || 'Erteleme işlemi başarısız.' });
  }
};
