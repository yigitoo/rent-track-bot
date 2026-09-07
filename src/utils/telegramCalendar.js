const dayjs = require('dayjs');
const { Markup } = require('telegraf');
const { formatCurrency, formatMonthYear, formatDate } = require('./format');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sameMonth(date, month, year) {
  const value = dayjs(date);
  return value.month() + 1 === month && value.year() === year;
}

function calendarData(month, year, statuses) {
  const events = {};
  for (const item of statuses) {
    const value = item.paid ? item.lastDate : item.dueDate;
    if (!value || !sameMonth(value, month, year)) continue;
    const day = dayjs(value).date();
    if (!events[day]) events[day] = [];
    events[day].push(item);
  }
  return events;
}

function marker(item) {
  if (item.paid) return '✓';
  if (item.partial) return '~';
  if (item.status === 'overdue') return '!';
  if (item.status === 'upcoming') return '›';
  return '·';
}

function statusText(item) {
  if (item.paid) return 'ödendi';
  if (item.partial) return 'eksik';
  if (item.status === 'overdue') return item.daysOverdue + ' gün gecikmiş';
  if (item.status === 'upcoming') return item.daysUntilDue === 0 ? 'bugün' : item.daysUntilDue + ' gün içinde';
  return 'ödenecek';
}

function buildTelegramCalendar({ month, year, statuses }) {
  const firstDay = dayjs().year(year).month(month - 1).date(1);
  const daysInMonth = firstDay.daysInMonth();
  const leadingDays = (firstDay.day() + 6) % 7;
  const events = calendarData(month, year, statuses);
  const cells = [];

  for (let i = 0; i < leadingDays; i += 1) cells.push('  ');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mark = events[day]?.[0] ? marker(events[day][0]) : ' ';
    cells.push(String(day).padStart(2, ' ') + mark);
  }
  while (cells.length % 7 !== 0) cells.push('  ');

  const lines = [
    '📅 <b>' + escapeHtml(formatMonthYear(month, year)) + '</b>',
    '',
    '<code>Pzt Sal Çar Per Cum Cmt Paz</code>',
  ];
  for (let i = 0; i < cells.length; i += 7) {
    lines.push('<code>' + cells.slice(i, i + 7).map((cell) => cell.padEnd(4, ' ')).join('') + '</code>');
  }

  const activeDays = Object.keys(events).sort((a, b) => Number(a) - Number(b));
  if (activeDays.length) {
    lines.push('', '<b>Bu ayın hareketleri</b>');
    activeDays.forEach((day) => {
      events[day].forEach((item) => {
        lines.push(
          marker(item) + ' ' + escapeHtml(item.tenant.name) +
          ' — ' + statusText(item) + ' · ' +
          formatCurrency(item.paid ? item.totalPaid : item.remaining) +
          (item.paid ? '' : ' · ' + formatDate(item.dueDate))
        );
      });
    });
  } else {
    lines.push('', 'Bu dönem için takvim kaydı yok.');
  }

  lines.push('', '✓ ödendi   ~ eksik   › yaklaşan   ! gecikti   · bekliyor');
  return lines.join('\n');
}

function calendarKeyboard(month, year) {
  const previous = dayjs().year(year).month(month - 2);
  const next = dayjs().year(year).month(month);
  return {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('← ' + previous.format('MMMM'), 'cal:' + previous.year() + ':' + (previous.month() + 1)),
        Markup.button.callback(next.format('MMMM') + ' →', 'cal:' + next.year() + ':' + (next.month() + 1)),
      ],
      [
        Markup.button.callback('🧾 Ödeme tablosu', 'nav:grid'),
        Markup.button.callback('📊 Bu ay', 'nav:status'),
      ],
      [Markup.button.callback('🏠 Ana menü', 'nav:home')],
    ]),
  };
}

module.exports = { buildTelegramCalendar, calendarKeyboard };
