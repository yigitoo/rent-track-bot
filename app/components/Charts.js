"use client";

import { formatCurrency } from "../lib/client";

/* Grafikler kütüphanesiz: sütunlar CSS ile çizilir, böylece hem ölçeklenir
   hem de metin bozulmaz. Sayılar her yerde tabular. */

export function TrendChart({ series, onSelect, activeKey }) {
  const max = Math.max(
    1,
    ...series.map((item) => Math.max(item.expected, item.received, item.expense))
  );

  return (
    <div className="trend">
      <div className="trend-scale" aria-hidden="true">
        <span className="num">{formatCurrency(max)}</span>
        <span className="num">{formatCurrency(max / 2)}</span>
        <span className="num">0</span>
      </div>

      <div className="trend-grid" role="list">
        {series.map((item) => {
          const key = item.year + "-" + item.month;
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              className={"trend-col" + (isActive ? " is-active" : "")}
              onClick={() => onSelect?.(item)}
              aria-label={
                item.label + ": beklenen " + formatCurrency(item.expected) +
                ", tahsil edilen " + formatCurrency(item.received) +
                ", gider " + formatCurrency(item.expense)
              }
              title={
                item.label +
                "\nBeklenen: " + formatCurrency(item.expected) +
                "\nTahsilat: " + formatCurrency(item.received) +
                "\nGider: " + formatCurrency(item.expense)
              }
            >
              <span className="trend-slot">
                <i className="trend-expected" style={{ height: (item.expected / max) * 100 + "%" }} />
                <i className="trend-received" style={{ height: (item.received / max) * 100 + "%" }} />
                <i className="trend-expense" style={{ height: (item.expense / max) * 100 + "%" }} />
              </span>
              <span className="trend-label">{item.short}</span>
            </button>
          );
        })}
      </div>

      <div className="trend-legend">
        <span className="tone-calm"><i className="legend-dot" />Beklenen</span>
        <span className="tone-accent"><i className="legend-dot" />Tahsilat</span>
        <span className="tone-warn"><i className="legend-dot" />Gider</span>
      </div>
    </div>
  );
}

export function BarList({ items, empty }) {
  if (!items.length) return <p className="chips-empty">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="barlist">
      {items.map((item) => (
        <div className="barlist-row" key={item.key}>
          <div className="barlist-top">
            <span>{item.label}</span>
            <strong className="num">{item.display}</strong>
          </div>
          <div className={"spark tone-" + (item.tone || "accent")}>
            <i style={{ width: Math.max((item.value / max) * 100, 2) + "%" }} />
          </div>
          {item.meta ? <span className="barlist-meta">{item.meta}</span> : null}
        </div>
      ))}
    </div>
  );
}
