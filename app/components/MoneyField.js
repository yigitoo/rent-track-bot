"use client";

import { useId, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { LIMITS, formatMoney, parseMoney, roundMoney } from "../../src/utils/money";

/* Tek para alanı. Yazarken ne kaydedileceğini anında gösterir: "45.000"
   yazan biri altında "45.000 TL" görür, "45" yazan da "45 TL" görür ve
   alt sınır uyarısını okur. Sürpriz kalmaz. */

export default function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
  kind = "payment",
  required = false,
  optional = false,
  autoFocus = false,
  disabled = false,
}) {
  const limit = LIMITS[kind] || LIMITS.payment;
  const fallbackId = useId();
  const inputId = id || fallbackId;
  const [dokunuldu, setDokunuldu] = useState(false);

  const ham = value === null || value === undefined ? "" : String(value);
  const bos = ham.trim() === "";
  const tutar = bos ? NaN : parseMoney(ham);
  const gecerli = Number.isFinite(tutar);
  const yuvarlanmis = gecerli ? roundMoney(tutar) : NaN;

  let durum = "bos";
  let mesaj = hint || "";

  if (!bos && !gecerli) {
    durum = "hata";
    mesaj = "Sayı okunamadı. Örnek: 45.000 ya da 45000";
  } else if (gecerli && yuvarlanmis < limit.min) {
    durum = "hata";
    mesaj = limit.label + " en az " + formatMoney(limit.min) + " olmalı · şu an " + formatMoney(yuvarlanmis) +
      (limit.min >= 1000 && yuvarlanmis < 1000 ? " (binlik için nokta: 45.000)" : "");
  } else if (gecerli && yuvarlanmis > limit.max) {
    durum = "hata";
    mesaj = limit.label + " en fazla " + formatMoney(limit.max) + " olabilir · şu an " + formatMoney(yuvarlanmis);
  } else if (gecerli) {
    durum = "tamam";
    mesaj = formatMoney(yuvarlanmis, { kurus: yuvarlanmis % 1 !== 0 });
  } else if (bos && optional) {
    durum = "bos";
    mesaj = hint || "Boş bırakılabilir";
  }

  const goster = dokunuldu || durum === "tamam";

  return (
    <div className={"field money-field is-" + durum}>
      <label htmlFor={inputId}>
        {label}
        {optional ? <span>(isteğe bağlı)</span> : null}
      </label>
      <div className="money-input">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={ham}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          placeholder={limit.min >= 1000 ? String(limit.min).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0"}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            setDokunuldu(true);
            // Kaydedilecek değeri olduğu gibi göster: "45.000" → "45.000"
            if (gecerli) onChange(new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(yuvarlanmis));
          }}
          aria-describedby={inputId + "-not"}
          aria-invalid={durum === "hata"}
        />
        <span className="money-suffix">TL</span>
      </div>
      <p className={"money-note tone-" + (durum === "hata" ? "bad" : durum === "tamam" ? "ok" : "muted")} id={inputId + "-not"}>
        {durum === "tamam" && goster ? <CheckCircle weight="fill" /> : null}
        {durum === "hata" && goster ? <WarningCircle weight="fill" /> : null}
        {goster || durum === "bos" ? mesaj : hint || ""}
      </p>
    </div>
  );
}
