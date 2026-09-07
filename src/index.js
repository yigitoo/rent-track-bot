require('dotenv').config();

const { Telegraf, Scenes, session } = require('telegraf');
const connectDB = require('./db');
const authMiddleware = require('./middleware/auth');
const { setupReminders } = require('./scheduler/reminders');
const { mongoSessionStore } = require('./utils/sessionStore');

const addTenantWizard = require('./scenes/addTenantWizard');
const editTenantWizard = require('./scenes/editTenantWizard');
const addPaymentWizard = require('./scenes/addPaymentWizard');
const deferRentWizard = require('./scenes/deferRentWizard');

const registerStartCommands = require('./commands/start');
const registerTenantCommands = require('./commands/tenant');
const registerPaymentCommands = require('./commands/payment');
const registerSummaryCommands = require('./commands/summary');
const registerGridCommands = require('./commands/grid');
const registerDuesCommands = require('./commands/dues');
const registerReportCommands = require('./commands/reports');
const registerMailCommands = require('./commands/mail');
const registerCalendarCommands = require('./commands/calendar');
const registerNotificationCommands = require('./commands/notifications');
const registerFinanceCommands = require('./commands/finance');

async function main() {
  await connectDB();

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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
  registerReportCommands(bot);
  registerMailCommands(bot);
  registerCalendarCommands(bot);
  registerNotificationCommands(bot);
  registerFinanceCommands(bot);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await bot.launch();
  console.log('Bot is running...');

  setupReminders();
}

main().catch(console.error);
