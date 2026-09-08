/* Tek para katmanı. Panel, API ve bot aynı ayrıştırıcıyı kullanır; "45.000"
   yazan biri 45 TL kaydetmiş olmasın diye.

   Kural: tek ayraçtan sonra tam üç hane varsa ve tam kısım 1-3 haneyse bu
   binlik ayracıdır (45.000 → 45000, 12,345 → 12345). Diğer her durumda
   ayraç ondalıktır (12,50 → 12.5). Belirsizlik kalmasın diye formda
   girilen değerin karşılığı anında gösterilir. */

const CURRENCY = /(?:TL|TRY|₺)/gi;

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

  let text = String(value ?? '').trim();
  if (!text) return NaN;

  text = text.replace(CURRENCY, '').replace(/[\s  ']/g, '');
  const negative = text.startsWith('-');
  text = text.replace(/^[+-]/, '');
  if (!/^\d[\d.,]*$/.test(text)) return NaN;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let whole = text;
  let fraction = '';

  if (lastDot !== -1 && lastComma !== -1) {
    // İkisi birden varsa sondaki ondalıktır: 1.234,56 ya da 1,234.56
    const decimal = Math.max(lastDot, lastComma);
    whole = text.slice(0, decimal).replace(/[.,]/g, '');
    fraction = text.slice(decimal + 1).replace(/[.,]/g, '');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const groups = text.split(sep);
    const tail = groups[groups.length - 1];
    const head = groups[0];
    const binlik = groups.length > 2
      ? groups.slice(1).every((g) => g.length === 3) && head.length >= 1 && head.length <= 3
      : tail.length === 3 && head.length >= 1 && head.length <= 3;

    if (binlik) {
      whole = groups.join('');
      fraction = '';
    } else {
      whole = groups.slice(0, -1).join('');
      fraction = tail;
    }
  }

  if (!whole) whole = '0';
  if (!/^\d+$/.test(whole) || (fraction && !/^\d+$/.test(fraction))) return NaN;

  const amount = Number(whole + (fraction ? '.' + fraction : ''));
  if (!Number.isFinite(amount)) return NaN;
  return negative ? -amount : amount;
}

/* Kuruş hassasiyeti: yuvarlama hatası birikmesin. */
function roundMoney(amount) {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMoney(amount, { kurus = false } = {}) {
  const value = Number(amount) || 0;
  return (kurus ? nf2 : nf).format(value) + ' TL';
}

/* Izgara hücresi gibi dar yerler için: 45.000 → "45B", 1.250.000 → "1,3M" */
function formatMoneyShort(amount) {
  const value = Math.abs(Number(amount) || 0);
  if (value >= 1000000) return (Math.round(value / 100000) / 10).toLocaleString('tr-TR') + 'M';
  if (value >= 1000) {
    const bin = value / 1000;
    return (bin >= 100 ? Math.round(bin) : Math.round(bin * 10) / 10).toLocaleString('tr-TR') + 'B';
  }
  return Math.round(value).toLocaleString('tr-TR');
}

/* Alan bazlı sınırlar tek yerde. Kira için alt sınır var: binlik ayracı
   yanlış okunduğunda ortaya çıkan 45 TL'lik kayıtlar buradan geçemez. */
const LIMITS = {
  rent: { min: 5000, max: 5000000, label: 'Kira tutarı' },
  deposit: { min: 0, max: 5000000, label: 'Depozito' },
  payment: { min: 1, max: 5000000, label: 'Ödeme tutarı' },
  expense: { min: 1, max: 5000000, label: 'Gider tutarı' },
  due: { min: 1, max: 500000, label: 'Aidat tutarı' },
  bus: { min: 0, max: 1000000, label: 'Tutar' },
};

/* Hata mesajı ne girildiğini de söyler: "45.000 yazdım ama 45 TL olmuş"
   şaşkınlığı bir kez yaşandı, bir daha yaşanmasın. */
function requireMoney(value, kind, { allowEmpty = false } = {}) {
  const limit = LIMITS[kind] || LIMITS.payment;
  if (allowEmpty && (value === '' || value === null || value === undefined)) return 0;

  const amount = parseMoney(value);
  if (!Number.isFinite(amount)) {
    throw new Error(limit.label + ' sayı olmalı. Örnek: 45.000 ya da 45000');
  }
  const rounded = roundMoney(amount);
  if (rounded < limit.min) {
    throw new Error(
      limit.label + ' en az ' + formatMoney(limit.min) + ' olmalı. Girilen: ' + formatMoney(rounded) +
      (limit.min >= 1000 && rounded < 1000 ? ' — binlik ayracı için nokta kullanın (45.000).' : '')
    );
  }
  if (rounded > limit.max) {
    throw new Error(limit.label + ' en fazla ' + formatMoney(limit.max) + ' olabilir. Girilen: ' + formatMoney(rounded));
  }
  return rounded;
}

module.exports = { LIMITS, formatMoney, formatMoneyShort, parseMoney, requireMoney, roundMoney };
