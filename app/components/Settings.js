"use client";

import { useEffect, useState } from "react";
import {
  ArrowCounterClockwise,
  BellRinging,
  CalendarCheck,
  CheckCircle,
  Envelope,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const CHAT_PATTERN = /^(-?\d{5,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

function RecipientEditor({
  id,
  icon: Glyph,
  title,
  caption,
  placeholder,
  hint,
  envName,
  values,
  defaults,
  usesDefaults,
  validate,
  invalidMessage,
  onChange,
  inputMode,
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function add() {
    const candidates = draft
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!candidates.length) return;
    const invalid = candidates.find((item) => !validate(item));
    if (invalid) {
      setError(invalidMessage + " " + invalid);
      return;
    }
    const merged = Array.from(new Set([...values, ...candidates]));
    if (merged.length > 20) {
      setError("En fazla 20 hedef eklenebilir.");
      return;
    }
    setError("");
    setDraft("");
    onChange(merged);
  }

  return (
    <article className="panel glass">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{caption}</p>
          <h2>{title}</h2>
        </div>
        <span className={"pill " + (values.length ? "pill-ok" : "pill-warn")}>
          {values.length ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
          {values.length ? values.length + " hedef" : "Hedef yok"}
        </span>
      </div>

      <div className="chips">
        {values.length ? (
          values.map((value) => (
            <span className="chip" key={value}>
              <Glyph weight="fill" />
              <span className="chip-text">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                aria-label={value + " hedefini kaldır"}
              >
                <X weight="bold" />
              </button>
            </span>
          ))
        ) : (
          <p className="chips-empty">Hedef yok, bu kanaldan bildirim gitmez.</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={id}>{hint}</label>
        <div className="input-row">
          <input
            id={id}
            value={draft}
            inputMode={inputMode}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError("");
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
          />
          <button className="btn btn-glass" type="button" onClick={add}>
            <Plus weight="bold" />
            Ekle
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            <WarningCircle weight="fill" />
            {error}
          </p>
        ) : null}
      </div>

      <div className="setting-foot">
        <p className="setting-note">
          <ShieldCheck weight="fill" />
          {usesDefaults
            ? "Vercel'deki " + envName + " değeri kullanılıyor."
            : "Bu liste " + envName + " değerinin yerine geçiyor."}
        </p>
        {!usesDefaults && defaults.length ? (
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => onChange([])}>
            <ArrowCounterClockwise weight="bold" />
            Varsayılana dön
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function SettingsView({ data, busy, saving, running, onSave, onRun }) {
  const settings = data.settings;
  const [emails, setEmails] = useState(settings.emailRecipients);
  const [chats, setChats] = useState(settings.telegramChatIds);

  useEffect(() => {
    setEmails(settings.emailRecipients);
    setChats(settings.telegramChatIds);
  }, [settings.emailRecipients, settings.telegramChatIds]);

  // Ortam değişkeniyle birebir aynı liste "varsayılan" sayılır: sunucu da
  // boş listeyi varsayılana dönüş olarak yorumluyor.
  const sameAs = (list, defaults) =>
    list.length === defaults.length && list.every((item, index) => item === defaults[index]);

  const emailIsDefault = sameAs(emails, settings.emailDefaults);
  const chatIsDefault = sameAs(chats, settings.telegramDefaults);
  const dirty =
    !sameAs(emails, settings.emailRecipients) || !sameAs(chats, settings.telegramChatIds);

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          {data.integrations.telegram ? "Telegram hazır" : "Telegram hedefi yok"}
          {" · "}
          {data.integrations.email ? "E-posta hazır" : "E-posta hedefi yok"}
        </p>
        <div className="view-actions">
          <button
            className={"btn btn-primary btn-sm" + (saving ? " is-busy" : "")}
            type="button"
            disabled={!dirty}
            onClick={() =>
              onSave({
                emailRecipients: emailIsDefault ? [] : emails,
                telegramChatIds: chatIsDefault ? [] : chats,
              })
            }
          >
            Değişiklikleri kaydet
          </button>
        </div>
      </div>

      <div className="duo duo-even">
        <RecipientEditor
          id="setting-telegram"
          icon={PaperPlaneTilt}
          caption="Bildirim kanalı"
          title="Telegram hedefleri"
          hint="Sohbet kimliği ya da @kullanıcı adı"
          placeholder="123456789 veya @kanaladi"
          envName="OWNER_CHAT_ID"
          values={chats}
          defaults={settings.telegramDefaults}
          usesDefaults={settings.usesTelegramDefaults && chatIsDefault}
          validate={(value) => CHAT_PATTERN.test(value)}
          invalidMessage="Geçersiz Telegram hedefi:"
          onChange={setChats}
          inputMode="text"
        />

        <RecipientEditor
          id="setting-email"
          icon={Envelope}
          caption="Rapor kanalı"
          title="E-posta alıcıları"
          hint="Birden fazla adres ekleyebilirsiniz"
          placeholder="ornek@posta.com"
          envName="EMAIL_TO"
          values={emails}
          defaults={settings.emailDefaults}
          usesDefaults={settings.usesEmailDefaults && emailIsDefault}
          validate={(value) => EMAIL_PATTERN.test(value)}
          invalidMessage="Geçersiz e-posta adresi:"
          onChange={setEmails}
          inputMode="email"
        />
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Elle çalıştır</p>
            <h2>Bildirimleri şimdi gönder</h2>
          </div>
        </div>
        <p className="setting-lead">
          Kayıtlı hedeflere test amaçlı gönderim yapar. Günlük özet, cron zaten çalıştıysa
          aynı gün için tekrar gönderilmez.
        </p>
        <div className="action-row">
          <button
            className={"btn btn-glass" + (running === "test" ? " is-busy" : "")}
            type="button"
            onClick={() => onRun("test")}
          >
            <PaperPlaneTilt weight="bold" />
            Telegram testi
          </button>
          <button
            className={"btn btn-glass" + (running === "email" ? " is-busy" : "")}
            type="button"
            onClick={() => onRun("email")}
          >
            <Envelope weight="bold" />
            Rapor e-postası
          </button>
          <button
            className={"btn btn-glass" + (running === "daily" ? " is-busy" : "")}
            type="button"
            onClick={() => onRun("daily")}
          >
            <BellRinging weight="bold" />
            Günlük özet
          </button>
          <button
            className={"btn btn-glass" + (running === "monthly" ? " is-busy" : "")}
            type="button"
            onClick={() => onRun("monthly")}
          >
            <CalendarCheck weight="bold" />
            Aylık özet
          </button>
        </div>
      </article>
    </div>
  );
}
