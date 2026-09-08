const { Telegraf, Scenes, session } = require('telegraf');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../db');
const authMiddleware = require('../middleware/auth');
const { mongoSessionStore } = require('../utils/sessionStore');

const addTenantWizard = require('../scenes/addTenantWizard');
const editTenantWizard = require('../scenes/editTenantWizard');
const addPaymentWizard = require('../scenes/addPaymentWizard');
const deferRentWizard = require('../scenes/deferRentWizard');

const registerStartCommands = require('../commands/start');
const registerTenantCommands = require('../commands/tenant');
const registerPaymentCommands = require('../commands/payment');
const registerSummaryCommands = require('../commands/summary');
const registerGridCommands = require('../commands/grid');
const registerDuesCommands = require('../commands/dues');
const registerBusCommands = require('../commands/bus');
const registerReportCommands = require('../commands/reports');
const registerMailCommands = require('../commands/mail');
const registerCalendarCommands = require('../commands/calendar');
const registerNotificationCommands = require('../commands/notifications');
const registerFinanceCommands = require('../commands/finance');

let bot;

function getBot() {
  if (bot) return bot;

  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  const stage = new Scenes.Stage([
    addTenantWizard,
    editTenantWizard,
    addPaymentWizard,
    deferRentWizard,
  ]);

  bot.use(session({ store: mongoSessionStore() }));
  bot.use(authMiddleware);
  bot.use(stage.middleware());

  registerStartCommands(bot);
  registerTenantCommands(bot);
  registerPaymentCommands(bot);
  registerSummaryCommands(bot);
  registerGridCommands(bot);
  registerDuesCommands(bot);
  registerBusCommands(bot);
  registerReportCommands(bot);
  registerMailCommands(bot);
  registerCalendarCommands(bot);
  registerNotificationCommands(bot);
  registerFinanceCommands(bot);

  return bot;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    const b = getBot();
    await b.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ ok: true });
  }
};
