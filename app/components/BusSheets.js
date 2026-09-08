"use client";

import { useMemo, useState } from "react";
import { Bus, Trash, WarningCircle } from "@phosphor-icons/react";
import { SheetFrame } from "./Sheets";
import MoneyField from "./MoneyField";
import { apiRequest, formatCurrency, formatDate, parseMoney } from "../lib/client";

const KALEMLER = [
  { key: "fuel", label: "Mazot" },
  { key: "wage", label: "Yövmiye" },
  { key: "fee", label: "Denekçi" },
  { key: "other", label: "Diğer" },
];

/* Elde tutulan kâğıdın birebir karşılığı: Toplam eksi kalemler, altında
   kalan. Yazarken hesaplanır, kaydetmeden önce rakam tutuyor mu görülür. */
export function BusDaySheet({ day, buses, busId, entry, month, year, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    busId: entry?.busId || busId || buses[0]?.id || "",
    gross: entry ? String(entry.gross) : "",
    fuel: entry ? String(entry.fuel) : "",
    wage: entry ? String(entry.wage) : "",
    fee: entry ? String(entry.fee) : "",
    other: entry ? String(entry.other) : "",
    otherNote: entry?.otherNote || "",
    note: entry?.note || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const sayi = (v) => {
    const n = parseMoney(v);
    return Number.isFinite(n) ? n : 0;
  };

  const gider = useMemo(
    () => KALEMLER.reduce((sum, item) => sum + sayi(form[item.key]), 0),
    [form.fuel, form.wage, form.fee, form.other]
  );
  const brut = sayi(form.gross);
  const kalan = Math.round((brut - gider) * 100) / 100;
  const tarih = new Date(year, month - 1, day, 12);

  async function submit(event) {
    event.preventDefault();
    if (!form.busId) {
      setError("Önce bir araç seçin.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      await apiRequest(
        "/api/bus",
        { method: "POST", body: JSON.stringify({ ...form, day, month, year }) },
        token
      );
      await onSaved(formatDate(tarih) + " kaydedildi · kalan " + formatCurrency(kalan));
    } catch (requestError) {
      setError(requestError.message);
      setBusy("");
    }
  }

  async function sil() {
    if (!entry?.id) return;
    setBusy("delete");
    setError("");
    try {
      await apiRequest("/api/bus?id=" + entry.id, { method: "DELETE" }, token);
      await onSaved(formatDate(tarih) + " kaydı silindi.");
    } catch (requestError) {
      setError(requestError.message);
      setBusy("");
    }
  }

  return (
    <SheetFrame
      eyebrow={entry ? "Günü düzenle" : "Gün kaydı"}
      title={formatDate(tarih)}
      onClose={onClose}
    >
      <form className="sheet-form" onSubmit={submit}>
        {buses.length > 1 ? (
          <div className="field">
            <label htmlFor="bus-day-bus">Araç</label>
            <select id="bus-day-bus" value={form.busId} onChange={(e) => update("busId", e.target.value)} required>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.number} numara{bus.label ? " · " + bus.label : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <MoneyField
          id="bus-gross"
          label="Toplam hasılat"
          kind="bus"
          required
          autoFocus
          value={form.gross}
          onChange={(v) => update("gross", v)}
          hint="Günün toplam geliri"
        />

        <p className="form-section">Giderler</p>
        <div className="form-grid">
          {KALEMLER.map((item) => (
            <MoneyField
              key={item.key}
              id={"bus-" + item.key}
              label={item.label}
              kind="bus"
              optional
              value={form[item.key]}
              onChange={(v) => update(item.key, v)}
            />
          ))}
          {sayi(form.other) > 0 ? (
            <div className="field span-2">
              <label htmlFor="bus-other-note">Diğer kalem açıklaması</label>
              <input
                id="bus-other-note"
                value={form.otherNote}
                onChange={(e) => update("otherNote", e.target.value)}
                maxLength={120}
                placeholder="Örn. lastik tamiri"
              />
            </div>
          ) : null}
          <div className="field span-2">
            <label htmlFor="bus-note">Not <span>(isteğe bağlı)</span></label>
            <input
              id="bus-note"
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              maxLength={240}
              placeholder="Arıza, ek sefer, hava durumu…"
            />
          </div>
        </div>

        <div className={"bus-sum" + (kalan < 0 ? " is-negative" : "")}>
          <div className="bus-sum-row">
            <span>Toplam</span>
            <strong className="num">{formatCurrency(brut)}</strong>
          </div>
          <div className="bus-sum-row is-minus">
            <span>Giderler</span>
            <strong className="num">− {formatCurrency(gider)}</strong>
          </div>
          <div className="bus-sum-row is-result">
            <span>Kalan</span>
            <strong className="num">{formatCurrency(kalan)}</strong>
          </div>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            <WarningCircle weight="fill" />
            {error}
          </p>
        ) : null}

        <div className="sheet-actions month-actions">
          {entry ? (
            <button className={"btn btn-quiet" + (busy === "delete" ? " is-busy" : "")} type="button" onClick={sil}>
              <Trash weight="bold" />
              Kaydı sil
            </button>
          ) : null}
          <button className="btn btn-quiet" type="button" onClick={onClose}>Vazgeç</button>
          <button className={"btn btn-primary" + (busy === "save" ? " is-busy" : "")} type="submit">
            {entry ? "Güncelle" : "Günü kaydet"}
          </button>
        </div>
      </form>
    </SheetFrame>
  );
}

/* Araç kaydı: "No = 7" kâğıttaki numaranın karşılığı. */
export function BusSheet({ bus, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    number: bus?.number || "",
    label: bus?.label || "",
    plate: bus?.plate || "",
    driver: bus?.driver || "",
    note: bus?.note || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (bus) {
        await apiRequest("/api/bus?scope=bus&id=" + bus.id, { method: "PUT", body: JSON.stringify(form) }, token);
        await onSaved(form.number + " numaralı araç güncellendi.");
      } else {
        await apiRequest("/api/bus?scope=bus", { method: "POST", body: JSON.stringify(form) }, token);
        await onSaved(form.number + " numaralı araç eklendi.");
      }
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <SheetFrame eyebrow="Hat aracı" title={bus ? "Aracı düzenle" : "Yeni araç"} onClose={onClose}>
      <form className="sheet-form" onSubmit={submit}>
        <p className="setting-lead">
          Kâğıttaki &quot;No&quot; alanı buraya karşılık gelir. Günlük kayıtlar bu numaraya bağlanır.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bus-number">Araç numarası</label>
            <input id="bus-number" value={form.number} onChange={(e) => update("number", e.target.value)} maxLength={20} placeholder="7" autoComplete="off" required />
          </div>
          <div className="field">
            <label htmlFor="bus-plate">Plaka <span>(isteğe bağlı)</span></label>
            <input id="bus-plate" value={form.plate} onChange={(e) => update("plate", e.target.value)} maxLength={20} placeholder="09 ABC 123" autoComplete="off" />
          </div>
          <div className="field span-2">
            <label htmlFor="bus-label">Hat adı <span>(isteğe bağlı)</span></label>
            <input id="bus-label" value={form.label} onChange={(e) => update("label", e.target.value)} maxLength={120} placeholder="Efeler – Merkez" autoComplete="off" />
          </div>
          <div className="field span-2">
            <label htmlFor="bus-driver">Şoför <span>(isteğe bağlı)</span></label>
            <input id="bus-driver" value={form.driver} onChange={(e) => update("driver", e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div className="field span-2">
            <label htmlFor="bus-note">Not <span>(isteğe bağlı)</span></label>
            <input id="bus-note" value={form.note} onChange={(e) => update("note", e.target.value)} maxLength={500} />
          </div>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            <WarningCircle weight="fill" />
            {error}
          </p>
        ) : null}
        <div className="sheet-actions">
          <button className="btn btn-quiet" type="button" onClick={onClose}>Vazgeç</button>
          <button className={"btn btn-primary" + (busy ? " is-busy" : "")} type="submit">
            <Bus weight="bold" />
            Kaydet
          </button>
        </div>
      </form>
    </SheetFrame>
  );
}
