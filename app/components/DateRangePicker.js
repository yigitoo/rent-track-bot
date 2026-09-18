"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretDoubleLeft, CaretDoubleRight, CaretLeft, CaretRight, X } from "@phosphor-icons/react";

/* Tarih aralığı seçici. Değerler "YYYY-AA-GG" metni olarak girer ve çıkar;
   API de aynı biçimi bekliyor. Tarihler öğlen saatine sabitlenir ki yaz
   saati geçişinde gün kaymasın. İlk tık başlangıç, ikinci tık bitiş:
   ikinci tık öncesine düşerse ikisi yer değiştirir. */

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const monthTitle = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
const shortLabel = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });

function toKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fromKey(key) {
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 12);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function daySpan(startKey, endKey) {
  const start = fromKey(startKey);
  const end = fromKey(endKey);
  if (!start || !end) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

export function formatRangeLabel(startKey, endKey) {
  const start = fromKey(startKey);
  const end = fromKey(endKey);
  if (!start || !end) return "";
  return shortLabel.format(start) + " – " + shortLabel.format(end);
}

function presets(todayKey) {
  const today = fromKey(todayKey);
  const minus = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return toKey(date);
  };
  const lastMonth = addMonths(today, -1);
  return [
    { id: "this-month", label: "Bu ay", start: toKey(startOfMonth(today)), end: todayKey },
    { id: "last-month", label: "Geçen ay", start: toKey(startOfMonth(lastMonth)), end: toKey(endOfMonth(lastMonth)) },
    { id: "30", label: "Son 30 gün", start: minus(29), end: todayKey },
    { id: "90", label: "Son 90 gün", start: minus(89), end: todayKey },
    { id: "this-year", label: "Bu yıl", start: today.getFullYear() + "-01-01", end: todayKey },
    {
      id: "last-year",
      label: "Geçen yıl",
      start: today.getFullYear() - 1 + "-01-01",
      end: today.getFullYear() - 1 + "-12-31",
    },
  ];
}

/* Bir ayın kutucukları: haftanın pazartesiden başladığı 6x7 ızgara.
   Ay dışındaki günler boş yer tutucu olur, seçilemez. */
function monthCells(monthDate) {
  const first = startOfMonth(monthDate);
  const lead = (first.getDay() + 6) % 7;
  const days = endOfMonth(monthDate).getDate();
  const cells = [];
  for (let index = 0; index < lead; index += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(toKey(new Date(first.getFullYear(), first.getMonth(), day, 12)));
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

function MonthGrid({ monthDate, draftStart, draftEnd, hoverKey, todayKey, maxKey, onPick, onHover }) {
  const cells = useMemo(() => monthCells(monthDate), [monthDate]);

  // Seçim sürerken (başlangıç var, bitiş yok) imlecin altındaki gün önizleme ucu olur.
  const previewEnd = draftStart && !draftEnd ? hoverKey : draftEnd;
  const [low, high] =
    draftStart && previewEnd
      ? draftStart <= previewEnd
        ? [draftStart, previewEnd]
        : [previewEnd, draftStart]
      : [draftStart, draftStart];

  return (
    <div className="drp-month">
      <p className="drp-month-title">{monthTitle.format(monthDate)}</p>
      <div className="drp-weekdays" aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="drp-grid" role="grid" aria-label={monthTitle.format(monthDate)}>
        {cells.map((key, index) => {
          if (!key) return <span key={"blank-" + index} className="drp-blank" aria-hidden="true" />;
          const disabled = Boolean(maxKey && key > maxKey);
          const isStart = Boolean(low && key === low);
          const isEnd = Boolean(high && key === high);
          const inside = Boolean(low && high && key > low && key < high);
          const weekday = index % 7;
          const classes = [
            "drp-day",
            inside ? "is-inside" : "",
            isStart ? "is-start" : "",
            isEnd ? "is-end" : "",
            isStart && isEnd ? "is-single" : "",
            low && high && low !== high && (isStart || isEnd || inside) ? "has-band" : "",
            weekday === 0 ? "is-row-start" : "",
            weekday === 6 ? "is-row-end" : "",
            key === todayKey ? "is-today" : "",
            !draftEnd && draftStart ? "is-previewing" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={key}
              type="button"
              className={classes}
              disabled={disabled}
              aria-label={dayLabel.format(fromKey(key))}
              aria-pressed={isStart || isEnd}
              onClick={() => onPick(key)}
              onMouseEnter={() => onHover(key)}
              onFocus={() => onHover(key)}
            >
              <span>{Number(key.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({
  start = "",
  end = "",
  onChange,
  onClear,
  max = "",
  placeholder = "Tarih aralığı seç",
  label = "Özel tarih aralığı",
  active = false,
}) {
  const todayKey = toKey(new Date());
  const maxKey = max || "";
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);
  const [hoverKey, setHoverKey] = useState("");
  const [view, setView] = useState(() => startOfMonth(addMonths(fromKey(end || todayKey), -1)));
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  // Açılışta taslak dışarıdaki değerle eşitlenir, görünüm bitiş ayına oturur.
  function openPicker() {
    setDraftStart(start);
    setDraftEnd(end);
    setHoverKey("");
    setView(startOfMonth(addMonths(fromKey(end || start || todayKey), -1)));
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) close(false);
    }
    function onKey(event) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(key) {
    if (!draftStart || draftEnd) {
      setDraftStart(key);
      setDraftEnd("");
      return;
    }
    if (key < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(key);
    } else {
      setDraftEnd(key);
    }
  }

  function applyPreset(preset) {
    const presetEnd = maxKey && preset.end > maxKey ? maxKey : preset.end;
    onChange?.({ start: preset.start, end: presetEnd });
    close();
  }

  function apply() {
    if (!draftStart || !draftEnd) return;
    onChange?.({ start: draftStart, end: draftEnd });
    close();
  }

  function clear() {
    setDraftStart("");
    setDraftEnd("");
    onClear?.();
    close();
  }

  const hasValue = Boolean(start && end);
  const draftDays = daySpan(draftStart, draftEnd);
  const presetList = useMemo(() => presets(todayKey), [todayKey]);
  const activePreset = presetList.find((item) => item.start === start && item.end === end)?.id;

  return (
    <div className={"drp" + (open ? " is-open" : "")} ref={rootRef}>
      <div className={"drp-trigger glass glass--chip" + (hasValue && active ? " is-active" : "")}>
        <button
          ref={triggerRef}
          type="button"
          className="drp-trigger-main"
          onClick={() => (open ? close() : openPicker())}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label + (hasValue ? ": " + formatRangeLabel(start, end) : "")}
        >
          <CalendarBlank weight="bold" />
          <span className="drp-trigger-text">{hasValue ? formatRangeLabel(start, end) : placeholder}</span>
        </button>
        {hasValue && onClear ? (
          <button type="button" className="drp-trigger-clear" aria-label="Aralığı temizle" onClick={clear}>
            <X weight="bold" />
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <div className="drp-scrim" aria-hidden="true" onClick={() => close(false)} />
          <div className="drp-pop" role="dialog" aria-label={label}>
            <div className="drp-presets" role="group" aria-label="Hazır aralıklar">
              {presetList.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={"drp-preset" + (activePreset === preset.id ? " is-active" : "")}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="drp-body">
              <div className="drp-nav">
                <div className="drp-nav-group">
                  <button type="button" className="drp-nav-btn" onClick={() => setView(addMonths(view, -12))} aria-label="Önceki yıl">
                    <CaretDoubleLeft weight="bold" />
                  </button>
                  <button type="button" className="drp-nav-btn" onClick={() => setView(addMonths(view, -1))} aria-label="Önceki ay">
                    <CaretLeft weight="bold" />
                  </button>
                </div>
                <button
                  type="button"
                  className="drp-today"
                  onClick={() => setView(startOfMonth(addMonths(fromKey(todayKey), -1)))}
                >
                  Bugüne dön
                </button>
                <div className="drp-nav-group">
                  <button type="button" className="drp-nav-btn" onClick={() => setView(addMonths(view, 1))} aria-label="Sonraki ay">
                    <CaretRight weight="bold" />
                  </button>
                  <button type="button" className="drp-nav-btn" onClick={() => setView(addMonths(view, 12))} aria-label="Sonraki yıl">
                    <CaretDoubleRight weight="bold" />
                  </button>
                </div>
              </div>

              <div className="drp-months" onMouseLeave={() => setHoverKey("")}>
                {[0, 1].map((offset) => (
                  <MonthGrid
                    key={offset}
                    monthDate={addMonths(view, offset)}
                    draftStart={draftStart}
                    draftEnd={draftEnd}
                    hoverKey={hoverKey}
                    todayKey={todayKey}
                    maxKey={maxKey}
                    onPick={pick}
                    onHover={setHoverKey}
                  />
                ))}
              </div>

              <div className="drp-foot">
                <p className="drp-summary" aria-live="polite">
                  {draftStart && draftEnd ? (
                    <>
                      <strong>{formatRangeLabel(draftStart, draftEnd)}</strong>
                      <span>{draftDays} gün</span>
                    </>
                  ) : draftStart ? (
                    <span>Bitiş gününü seçin</span>
                  ) : (
                    <span>Başlangıç gününü seçin</span>
                  )}
                </p>
                <div className="drp-actions">
                  {onClear ? (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={clear}>
                      Temizle
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-glass btn-sm" onClick={() => close()}>
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={apply}
                    disabled={!draftStart || !draftEnd}
                  >
                    Uygula
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
