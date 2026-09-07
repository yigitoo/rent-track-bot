const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const Notification = require('../models/notification');
const { requireWebAuth } = require('../utils/webAuth');
const {
  runDailyReminder,
  runDueReminders,
  runMonthlyReminder,
  sendOwnerNotification,
  sendReportMail,
} = require('../services/notificationService');
const { isTelegramConfigured } = require('../services/telegram');

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireWebAuth(req, res)) return;

  try {
    if (mongoose.connection.readyState !== 1) await connectDB();

    if (req.method === 'GET') {
      const notifications = await Notification.find()
        .sort({ createdAt: -1 })
        .limit(40)
        .lean();
      return res.status(200).json({
        configured: isTelegramConfigured(),
        notifications: notifications.map((item) => ({
          id: item._id.toString(),
          type: item.type,
          title: item.title,
          message: item.message,
          status: item.status,
          error: item.error || '',
          sentAt: item.sentAt ? new Date(item.sentAt).toISOString() : null,
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        })),
      });
    }

    const action = String(req.body?.action || 'test');
    if (action === 'daily') return res.status(200).json(await runDailyReminder());
    if (action === 'due') return res.status(200).json(await runDueReminders());
    if (action === 'monthly') return res.status(200).json(await runMonthlyReminder());
    if (action === 'email') {
      const result = await sendReportMail();
      return res.status(result.sent ? 200 : 503).json(result);
    }

    const result = await sendOwnerNotification({
      type: 'connection_test',
      title: 'Telegram bağlantı testi',
      message: '🔎 Vedat Gayrimenkul bağlantı testi\\n\\nWeb panelinden gönderildi. Telegram bildirimleri çalışıyor.',
      metadata: { source: 'web' },
    });
    return res.status(result.sent ? 200 : 503).json(result);
  } catch (error) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ error: 'Bildirim işlemi başarısız.' });
  }
};
