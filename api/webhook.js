const { Telegraf, Scenes, session } = require('telegraf');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../src/db');
const authMiddleware = require('../src/middleware/auth');
const { mongoSessionStore } = require('../src/utils/sessionStore');

const addTenantWizard = require('../src/scenes/addTenantWizard');
const editTenantWizard = require('../src/scenes/editTenantWizard');
const addPaymentWizard = require('../src/scenes/addPaymentWizard');

const registerStartCommands = require('../src/commands/start');
const registerTenantCommands = require('../src/commands/tenant');
const registerPaymentCommands = require('../src/commands/payment');
const registerStatusCommands = require('../src/commands/status');
const registerSummaryCommands = require('../src/commands/summary');
const registerMailCommands = require('../src/commands/mail');

let bot;

function getBot() {
  if (bot) return bot;

  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  const stage = new Scenes.Stage([
    addTenantWizard,
    editTenantWizard,
    addPaymentWizard,
  ]);

  bot.use(session({ store: mongoSessionStore() }));
  bot.use(authMiddleware);
  bot.use(stage.middleware());

  registerStartCommands(bot);
  registerTenantCommands(bot);
  registerPaymentCommands(bot);
  registerStatusCommands(bot);
  registerSummaryCommands(bot);
  registerMailCommands(bot);

  return bot;
}

module.exports = async (req, res) => {
  try {
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
