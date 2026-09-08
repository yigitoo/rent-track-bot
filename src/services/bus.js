const Bus = require('../models/bus');
const BusDay = require('../models/busDay');
const { formatMonthYear, now } = require('../utils/format');
const { requireMoney } = require('../utils/money');

/* Otobüs hattı defteri. Gün gün yazılır, ay sonunda kalem kalem toplanır.
   Kira tarafıyla aynı mantık: tek servis, panel de bot da buradan geçer. */

const KALEMLER = ['fuel', 'wage', 'fee', 'other'];
const ETIKET = BusDay.LABELS;

function normalizePeriod(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('Geçersiz ay.');
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Geçersiz yıl.');
  return { month: m, year: y };
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function serializeBus(bus) {
  return {
    id: bus._id.toString(),
    number: bus.number,
    label: bus.label || '',
    plate: bus.plate || '',
    driver: bus.driver || '',
    note: bus.note || '',
    isActive: bus.isActive !== false,
  };
}

function serializeDay(entry) {
  return {
    id: entry._id.toString(),
    busId: entry.bus?._id?.toString() || entry.bus?.toString() || '',
    busNumber: entry.bus?.number || '',
    date: entry.date ? new Date(entry.date).toISOString() : null,
    day: entry.day,
    month: entry.month,
    year: entry.year,
    gross: entry.gross || 0,
    fuel: entry.fuel || 0,
    wage: entry.wage || 0,
    fee: entry.fee || 0,
    other: entry.other || 0,
    otherNote: entry.otherNote || '',
    note: entry.note || '',
    net: entry.net || 0,
  };
}

function bosToplam() {
  return { gross: 0, fuel: 0, wage: 0, fee: 0, other: 0, expense: 0, net: 0, days: 0 };
}

function topla(kayitlar) {
  const t = bosToplam();
  for (const k of kayitlar) {
    t.gross += k.gross || 0;
    for (const alan of KALEMLER) t[alan] += k[alan] || 0;
    t.days += 1;
  }
  t.expense = KALEMLER.reduce((sum, alan) => sum + t[alan], 0);
  t.net = Math.round((t.gross - t.expense) * 100) / 100;
  return t;
}

async function listBuses({ includeArchived = false } = {}) {
  const filter = includeArchived ? {} : { isActive: true };
  const buses = await Bus.find(filter).sort({ number: 1 });
  return buses.map(serializeBus);
}

async function saveBus(input, id) {
  const number = String(input.number || '').trim();
  if (!number || number.length > 20) throw new Error('Araç numarası 1-20 karakter olmalı.');

  const veri = {
    number,
    label: String(input.label || '').trim().slice(0, 120),
    plate: String(input.plate || '').trim().slice(0, 20).toLocaleUpperCase('tr-TR'),
    driver: String(input.driver || '').trim().slice(0, 120),
    note: String(input.note || '').trim().slice(0, 500),
  };

  try {
    if (id) {
      const bus = await Bus.findByIdAndUpdate(id, veri, { new: true });
      if (!bus) throw new Error('Araç bulunamadı.');
      return serializeBus(bus);
    }
    return serializeBus(await Bus.create(veri));
  } catch (error) {
    if (error.code === 11000) throw new Error(number + ' numaralı araç zaten kayıtlı.');
    throw error;
  }
}

/* Bir ayın tüm günleri. Kayıt olmayan günler de döner ki takvimde boş
   kutucuk görünsün ve dokunulduğunda doldurulabilsin. */
async function loadMonth({ month, year, busId = '' }) {
  const period = normalizePeriod(month, year);
  const buses = await Bus.find({ isActive: true }).sort({ number: 1 });
  const filter = { month: period.month, year: period.year };
  if (busId) filter.bus = busId;

  const kayitlar = await BusDay.find(filter).populate('bus', 'number').sort({ day: 1 });
  const gunSayisi = daysInMonth(period.month, period.year);
  const bugun = now();
  const buAy = bugun.year() === period.year && bugun.month() + 1 === period.month;

  const gunler = Array.from({ length: gunSayisi }, (unused, index) => {
    const day = index + 1;
    const gunKayitlari = kayitlar.filter((k) => k.day === day);
    return {
      day,
      date: new Date(period.year, period.month - 1, day, 12).toISOString(),
      isToday: buAy && bugun.date() === day,
      isFuture: period.year > bugun.year() ||
        (period.year === bugun.year() && period.month > bugun.month() + 1) ||
        (buAy && day > bugun.date()),
      entries: gunKayitlari.map(serializeDay),
      totals: topla(gunKayitlari),
    };
  });

  const perBus = buses.map((bus) => {
    const id = bus._id.toString();
    const kendi = kayitlar.filter((k) => (k.bus?._id?.toString() || k.bus?.toString()) === id);
    return { ...serializeBus(bus), totals: topla(kendi) };
  });

  return {
    month: period.month,
    year: period.year,
    label: formatMonthYear(period.month, period.year),
    busId,
    buses: buses.map(serializeBus),
    perBus,
    days: gunler,
    totals: topla(kayitlar),
    labels: ETIKET,
  };
}

async function saveDay(input) {
  const period = normalizePeriod(input.month, input.year);
  const day = Number(input.day);
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(period.month, period.year)) {
    throw new Error('Geçersiz gün.');
  }

  const busId = String(input.busId || '').trim();
  const bus = await Bus.findById(busId);
  if (!bus) throw new Error('Araç seçilmedi.');

  const gross = requireMoney(input.gross, 'bus', { allowEmpty: true });
  const kalem = {};
  for (const alan of KALEMLER) kalem[alan] = requireMoney(input[alan], 'bus', { allowEmpty: true });

  const gider = KALEMLER.reduce((sum, alan) => sum + kalem[alan], 0);
  if (gider > gross && gross > 0) {
    // Uyarı değil hata değil: eksi kalan olabilir, kullanıcı bilerek girmiş olabilir.
  }

  const veri = {
    bus: bus._id,
    date: new Date(period.year, period.month - 1, day, 12),
    day,
    month: period.month,
    year: period.year,
    gross,
    ...kalem,
    otherNote: String(input.otherNote || '').trim().slice(0, 120),
    note: String(input.note || '').trim().slice(0, 240),
    source: input.source === 'telegram' ? 'telegram' : 'web',
  };

  const mevcut = await BusDay.findOne({ bus: bus._id, year: period.year, month: period.month, day });
  if (mevcut) {
    Object.assign(mevcut, veri);
    await mevcut.save();
    return { entry: serializeDay(await mevcut.populate('bus', 'number')), bus: serializeBus(bus), created: false };
  }

  const olusan = await BusDay.create(veri);
  return { entry: serializeDay(await olusan.populate('bus', 'number')), bus: serializeBus(bus), created: true };
}

async function deleteDay(id) {
  const entry = await BusDay.findById(id).populate('bus', 'number');
  if (!entry) throw new Error('Kayıt bulunamadı.');
  const snapshot = serializeDay(entry);
  await entry.deleteOne();
  return snapshot;
}

/* Ay sonu raporu: gün gün satırlar ve kalem kalem toplam. */
async function monthReport({ month, year, busId = '' }) {
  const period = normalizePeriod(month, year);
  const filter = { month: period.month, year: period.year };
  if (busId) filter.bus = busId;

  const kayitlar = await BusDay.find(filter).populate('bus', 'number').sort({ day: 1 });
  const buses = await Bus.find({ isActive: true }).sort({ number: 1 });

  const perBus = buses
    .map((bus) => {
      const id = bus._id.toString();
      const kendi = kayitlar.filter((k) => (k.bus?._id?.toString() || k.bus?.toString()) === id);
      return { ...serializeBus(bus), totals: topla(kendi) };
    })
    .filter((item) => (busId ? item.id === busId : item.totals.days > 0));

  const rows = kayitlar.map(serializeDay);
  const totals = topla(kayitlar);
  const gunSayisi = daysInMonth(period.month, period.year);

  return {
    scope: 'bus-month',
    month: period.month,
    year: period.year,
    label: formatMonthYear(period.month, period.year),
    busId,
    rows,
    perBus,
    totals: {
      ...totals,
      averageGross: totals.days ? Math.round(totals.gross / totals.days) : 0,
      averageNet: totals.days ? Math.round(totals.net / totals.days) : 0,
      margin: totals.gross ? Math.round((totals.net / totals.gross) * 100) : 0,
      missingDays: Math.max(gunSayisi - new Set(rows.map((r) => r.day)).size, 0),
      dayCount: gunSayisi,
    },
    labels: ETIKET,
  };
}

/* Kayan dönem: son N ayın aylık serisi. Rapor sayfasındaki grafik için. */
async function rangeReport(monthCount = 12) {
  const bugun = now();
  const aylar = [];
  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const d = new Date(bugun.year(), bugun.month() - index, 1);
    aylar.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const ilk = aylar[0];
  const kayitlar = await BusDay.find({
    date: { $gte: new Date(ilk.year, ilk.month - 1, 1) },
  }).populate('bus', 'number');

  const series = aylar.map(({ month, year }) => {
    const kendi = kayitlar.filter((k) => k.month === month && k.year === year);
    const t = topla(kendi);
    return {
      month,
      year,
      label: formatMonthYear(month, year),
      short: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(new Date(year, month - 1, 1)),
      ...t,
    };
  });

  const totals = topla(kayitlar);
  const best = series.reduce((top, item) => (item.net > (top?.net ?? -Infinity) ? item : top), null);

  return {
    scope: 'bus-range',
    months: monthCount,
    series,
    totals: {
      ...totals,
      averageMonthly: series.length ? Math.round(totals.net / series.length) : 0,
      margin: totals.gross ? Math.round((totals.net / totals.gross) * 100) : 0,
      bestMonth: best ? { label: best.label, net: best.net } : null,
    },
    labels: ETIKET,
  };
}

module.exports = {
  ETIKET,
  KALEMLER,
  deleteDay,
  listBuses,
  loadMonth,
  monthReport,
  rangeReport,
  saveBus,
  saveDay,
  serializeBus,
  serializeDay,
};
