"use client";

import { useState } from "react";
import { ArrowCounterClockwise, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react";
import { SheetFrame } from "./Sheets";
import MoneyField from "./MoneyField";
import { apiRequest, formatCurrency, formatDate, parseMoney } from "../lib/client";

const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DURUM = {
  paid: { etiket: "Ödendi", ton: "ok", ikon: CheckCircle },
  partial: { etiket: "Eksik ödeme", ton: "warn", ikon: WarningCircle },
  overdue: { etiket: "Gecikti", ton: "bad", ikon: WarningCircle },
  upcoming: { etiket: "Yaklaşıyor", ton: "calm", ikon: Clock },
  pending: { etiket: "Ödenecek", ton: "calm", ikon: Clock },
  future: { etiket: "Sırada", ton: "calm", ikon: Clock },
  outside: { etiket: "Sözleşme öncesi", ton: "calm", ikon: Clock },
};

/* Tek bir ayın penceresi. Izgarada yanlış girilen ay buradan düzeltilir:
   tutarı değiştir, tamamla ya da işareti tamamen kaldır. */
export default function MonthSheet({ kind = "rent", row, cell, year, token, onClose, onSaved }) {
  const aidat = kind === "due";
  const beklenen = aidat ? cell.amount : cell.expected;
  const [tutar, setTutar] = useState(String(cell.paid > 0 ? cell.paid : beklenen || ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const baslik = (aidat ? row.label : row.name) + " · " + AYLAR[cell.month - 1] + " " + year;
  const durum = DURUM[cell.status] || DURUM.pending;
  const Ikon = durum.ikon;
  const girilen = parseMoney(tutar);
  const degisti = Number.isFinite(girilen) && girilen !== (cell.paid || 0);

  async function kaydet(event) {
    event.preventDefault();
    setBusy("save");
    setError("");
    try {
      if (aidat) {
        await apiRequest(
          "/api/dues",
          { method: "POST", body: JSON.stringify({ dueId: row.dueId, month: cell.month, year, amount: tutar, paid: true }) },
          token
        );
      } else {
        await apiRequest(
          "/api/payments",
          { method: "POST", body: JSON.stringify({ tenantId: row.tenantId, month: cell.month, year, setAmount: tutar }) },
          token
        );
      }
      await onSaved(baslik + " · " + formatCurrency(girilen) + " olarak kaydedildi.");
    } catch (requestError) {
      setError(requestError.message);
      setBusy("");
    }
  }

  async function kaldir() {
    setBusy("clear");
    setError("");
    try {
      const url = aidat
        ? "/api/dues?dueId=" + row.dueId + "&month=" + cell.month + "&year=" + year
        : "/api/payments?tenantId=" + row.tenantId + "&month=" + cell.month + "&year=" + year;
      await apiRequest(url, { method: "DELETE" }, token);
      await onSaved(baslik + " işareti kaldırıldı.");
    } catch (requestError) {
      setError(requestError.message);
      setBusy("");
    }
  }

  return (
    <SheetFrame eyebrow="Dönem düzeltme" title={baslik} onClose={onClose}>
      <form className="sheet-form" onSubmit={kaydet}>
        <div className="month-facts">
          <div className="month-fact">
            <span>Durum</span>
            <strong className={"tone-" + durum.ton}>
              <Ikon weight="fill" />
              {durum.etiket}
            </strong>
          </div>
          <div className="month-fact">
            <span>{aidat ? "Kalem tutarı" : "Beklenen kira"}</span>
            <strong className="num">{formatCurrency(beklenen)}</strong>
          </div>
          <div className="month-fact">
            <span>Kayıtlı</span>
            <strong className="num">{formatCurrency(cell.paid || 0)}</strong>
          </div>
          <div className="month-fact">
            <span>Son ödeme günü</span>
            <strong>{formatDate(cell.dueDate)}</strong>
          </div>
        </div>

        <MoneyField
          id="month-amount"
          label={aidat ? "Bu ay ödenen aidat" : "Bu ay ödenen kira"}
          kind={aidat ? "due" : "payment"}
          required
          autoFocus
          value={tutar}
          onChange={setTutar}
          hint="Yanlış girdiyseniz doğru tutarı yazın; ayın kaydı bununla değişir."
        />

        {!aidat && beklenen && Number.isFinite(girilen) && girilen !== beklenen ? (
          <button
            type="button"
            className="btn btn-quiet btn-sm month-suggest"
            onClick={() => setTutar(String(beklenen))}
          >
            Beklenen tutara eşitle · {formatCurrency(beklenen)}
          </button>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            <WarningCircle weight="fill" />
            {error}
          </p>
        ) : null}

        <div className="sheet-actions month-actions">
          {cell.paid > 0 ? (
            <button
              className={"btn btn-quiet" + (busy === "clear" ? " is-busy" : "")}
              type="button"
              onClick={kaldir}
            >
              <ArrowCounterClockwise weight="bold" />
              İşareti kaldır
            </button>
          ) : null}
          <button className="btn btn-quiet" type="button" onClick={onClose}>Vazgeç</button>
          <button
            className={"btn btn-primary" + (busy === "save" ? " is-busy" : "")}
            type="submit"
            disabled={!Number.isFinite(girilen)}
          >
            {cell.paid > 0 ? (degisti ? "Tutarı güncelle" : "Kaydet") : "Ödendi olarak kaydet"}
          </button>
        </div>
      </form>
    </SheetFrame>
  );
}
