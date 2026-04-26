require('dotenv').config();

const { Telegraf, Scenes, session } = require('telegraf');
const connectDB = require('./db');
const authMiddleware = require('./middleware/auth');
const { setupReminders } = require('./scheduler/reminders');
const { mongoSessionStore } = require('./utils/sessionStore');

const addTenantWizard = require('./scenes/addTenantWizard');
const editTenantWizard = require('./scenes/editTenantWizard');
const addPaymentWizard = require('./scenes/addPaymentWizard');

const registerStartCommands = require('./commands/start');
const registerTenantCommands = require('./commands/tenant');
const registerPaymentCommands = require('./commands/payment');
const registerStatusCommands = require('./commands/status');
const registerSummaryCommands = require('./commands/summary');
const registerMailCommands = require('./commands/mail');

async function main() {
  await connectDB();

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await bot.launch();
  console.log('Bot is running...');

  setupReminders(bot);
}

main().catch(console.error);
