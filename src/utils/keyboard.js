const { Markup } = require('telegraf');

function tenantListKeyboard(tenants, prefix) {
  const buttons = tenants.map((t) =>
    Markup.button.callback(t.name, `${prefix}:${t._id}`)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return Markup.inlineKeyboard(rows);
}

function confirmKeyboard(yesData, noData) {
  return Markup.inlineKeyboard([
    Markup.button.callback('Onayla', yesData),
    Markup.button.callback('İptal', noData),
  ]);
}

function cancelKeyboard() {
  return Markup.inlineKeyboard([
    Markup.button.callback('İptal', 'cancel_wizard'),
  ]);
}

module.exports = { tenantListKeyboard, confirmKeyboard, cancelKeyboard };
