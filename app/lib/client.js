"use client";

const SESSION_KEY = "kira-akis-session";
const THEME_KEY = "kira-akis-theme";

export function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* özel pencerede depolama kapalı olabilir; oturum yalnız çerezle sürer */
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* yoksay */
  }
}

export function readTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* yoksay */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function writeTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* yoksay */
  }
}

export async function apiRequest(url, options = {}, token = "") {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-app-token": token } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "İşlem tamamlanamadı.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

const currency = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function formatCurrency(value) {
  return currency.format(Number(value || 0)) + " TL";
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function formatShortDate(value, withYear = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function monthName(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(date);
}

export function periodLabel(period) {
  if (!period?.month || !period?.year) return "—";
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
    new Date(period.year, period.month - 1, 1)
  );
}

export function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("tr-TR") || "KA"
  );
}

export function currentPeriod() {
  const date = new Date();
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

// Durum rengi tek başına anlam taşımaz: her zaman etiket ve simgeyle birlikte.
export function statusView(item) {
  if (item.paid) return { key: "paid", tone: "ok", label: "Ödendi" };
  if (item.partial) return { key: "partial", tone: "warn", label: "Eksik ödeme" };
  if (item.status === "overdue") return { key: "overdue", tone: "bad", label: "Gecikti" };
  if (item.status === "upcoming") return { key: "upcoming", tone: "calm", label: "Yaklaşıyor" };
  return { key: "pending", tone: "calm", label: "Ödenecek" };
}

export function statusDetail(item) {
  if (item.paid) return item.lastDate ? formatDate(item.lastDate) + " tarihinde tahsil edildi" : "Dönem tamamlandı";
  if (item.daysOverdue > 0) return item.daysOverdue + " gün gecikti";
  if (item.daysUntilDue === 0) return "Son gün bugün";
  if (item.daysUntilDue > 0) return item.daysUntilDue + " gün kaldı";
  return "Son ödeme " + formatDate(item.dueDate);
}

/* Türkçe Excel noktalı virgülle ayrılmış CSV bekler; BOM olmadan da
   ğ/ş/İ bozulur. İkisi de bilinçli. */
export function downloadCsv(filename, headers, rows) {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[";\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* PDF'i jetonla çekip indirir: düz bağlantı yetki başlığını taşımaz. */
export async function downloadFile(url, token, fallbackName) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: token ? { "x-app-token": token } : {},
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || "Dosya hazırlanamadı.");
    error.status = response.status;
    throw error;
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = match ? match[1] : fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
