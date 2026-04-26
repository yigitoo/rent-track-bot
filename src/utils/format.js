const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
require('dayjs/locale/tr');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('tr');

function tz() {
  const val = (process.env.TIMEZONE || 'Europe/Istanbul').trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: val });
    return val;
  } catch {
    return 'Europe/Istanbul';
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR').format(amount) + ' TL';
}

function formatDate(date) {
  return dayjs(date).utcOffset(3).format('DD MMM YYYY');
}

function formatMonthYear(month, year) {
  return dayjs().month(month - 1).year(year).format('MMMM YYYY');
}

function now() {
  return dayjs().utcOffset(3);
}

function currentMonth() {
  const d = now();
  return { month: d.month() + 1, year: d.year() };
}

module.exports = { formatCurrency, formatDate, formatMonthYear, now, currentMonth };
