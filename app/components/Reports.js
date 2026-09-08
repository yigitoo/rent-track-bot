"use client";

import {
  ArrowUpRight,
  CalendarX,
  ChartLineUp,
  DownloadSimple,
  FilePdf,
  TrendUp,
  Vault,
  WarningCircle,
} from "@phosphor-icons/react";
import { BarList, TrendChart } from "./Charts";
import { downloadCsv, formatCurrency, formatDate } from "../lib/client";

const RANGES = [
  [6, "6 ay"],
  [12, "12 ay"],
  [24, "24 ay"],
];

const MONTH_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const CELL_LABEL = {
  paid: { text: "Ö", title: "Ödendi" },
  partial: { text: "E", title: "Eksik ödeme" },
  unpaid: { text: "·", title: "Ödenmedi" },
  future: { text: "", title: "Henüz gelmedi" },
  outside: { text: "–", title: "Henüz kiracı değil" },
};

function Loading({ label }) {
  return (
    <div className="view" aria-busy="true">
      <div className="empty">
        <ChartLineUp weight="duotone" />
        <strong>{label}</strong>
        <span>Son dönemlerin tahsilat ve gider verisi toplanıyor.</span>
      </div>
    </div>
  );
}

/* ---------- Yıllık: kiracı × ay tablosu ---------- */

function AnnualView({ annual, year, years, busy, downloading, onYear, onPdf, onOpenTenant }) {
  if (!annual) return <Loading label="Yıllık rapor hazırlanıyor" />;

  const totals = annual.totals;
  const today = new Date();
  const currentMonth =
    annual.year === today.getFullYear() ? today.getMonth() + 1 : annual.year < today.getFullYear() ? 12 : 0;

  function exportCsv() {
    downloadCsv(
      "vedat-gayrimenkul-" + annual.year + "-yillik.csv",
      ["Kiracı", "Dahil olduğu ay", ...MONTH_SHORT, "Beklenen", "Tahsil edilen", "Oran"],
      annual.rows.map((row) => [
        row.name,
        row.startLabel,
        ...row.cells.map((cell) => CELL_LABEL[cell.state].title),
        row.expected,
        row.received,
        row.rate + "%",
      ])
    );
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          {annual.year} · {totals.tenantCount} kiracı · {formatCurrency(totals.received)} tahsilat
          {totals.newTenants ? " · yıl içinde katılan " + totals.newTenants : ""}
        </p>
        <div className="view-actions">
          <div className="filters glass glass--chip" role="group" aria-label="Yıl seçimi">
            {years.map((value) => (
              <button
                key={value}
                type="button"
                className={"filter" + (year === value ? " is-active" : "")}
                onClick={() => onYear(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button className="btn btn-glass btn-sm" type="button" onClick={exportCsv}>
            <DownloadSimple weight="bold" />
            CSV
          </button>
          <button
            className={"btn btn-primary btn-sm" + (downloading ? " is-busy" : "")}
            type="button"
            onClick={() => onPdf("annual")}
          >
            <FilePdf weight="bold" />
            PDF indir
          </button>
        </div>
      </div>

      <div className="bento bento-4">
        <article className="tile glass" style={{ "--i": 0 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Tahsil edilen</div>
          <div className="tile-value num">{formatCurrency(totals.received)}</div>
          <div className="spark tone-accent"><i style={{ width: totals.rate + "%" }} /></div>
          <p className="tile-meta">%{totals.rate} · beklenen {formatCurrency(totals.expected)}</p>
        </article>
        <article className="tile glass" style={{ "--i": 1 }}>
          <div className="tile-head"><ChartLineUp weight="duotone" />Net gelir</div>
          <div className={"tile-value num" + (totals.net >= 0 ? "" : " tone-bad")}>
            {formatCurrency(totals.net)}
          </div>
          <p className="tile-meta">{formatCurrency(totals.expense)} gider düşüldü</p>
        </article>
        <article className="tile glass" style={{ "--i": 2 }}>
          <div className="tile-head"><Vault weight="duotone" />Yıl içinde katılan</div>
          <div className="tile-value num">{totals.newTenants}</div>
          <p className="tile-meta">{totals.tenantCount} kiracı tabloda</p>
        </article>
        <article className="tile glass" style={{ "--i": 3 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Aylık ortalama</div>
          <div className="tile-value num">
            {formatCurrency(Math.round(totals.received / Math.max(currentMonth || 12, 1)))}
          </div>
          <p className="tile-meta">{currentMonth || 12} ay üzerinden</p>
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Zaman içinde</p>
            <h2>{annual.year} aylık seyri</h2>
          </div>
        </div>
        <TrendChart series={annual.series} />
      </article>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Kiracı × ay</p>
            <h2>Kim hangi ay ödedi</h2>
          </div>
          <div className="matrix-legend">
            <span className="matrix-key state-paid">Ö</span> ödendi
            <span className="matrix-key state-partial">E</span> eksik
            <span className="matrix-key state-unpaid">·</span> ödenmedi
            <span className="matrix-key state-outside">–</span> kiracı değil
          </div>
        </div>

        {annual.rows.length ? (
          <div className="matrix-scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col" className="matrix-name">Kiracı</th>
                  <th scope="col" className="matrix-join">Dahil olduğu ay</th>
                  {MONTH_SHORT.map((label, index) => (
                    <th scope="col" key={label} className={index + 1 === currentMonth ? "is-now" : ""}>
                      {label}
                    </th>
                  ))}
                  <th scope="col" className="matrix-total">Tahsilat</th>
                  <th scope="col" className="matrix-rate">Oran</th>
                </tr>
              </thead>
              <tbody>
                {annual.rows.map((row) => (
                  <tr key={row.tenantId}>
                    <th scope="row" className="matrix-name">
                      <button type="button" onClick={() => onOpenTenant(row.tenantId)}>
                        {row.name}
                        <ArrowUpRight weight="bold" />
                      </button>
                    </th>
                    <td className="matrix-join">{row.startLabel}</td>
                    {row.cells.map((cell) => {
                      const info = CELL_LABEL[cell.state];
                      return (
                        <td key={cell.month} className={"matrix-cell state-" + cell.state + (cell.isStart ? " is-start" : "")}>
                          <span
                            title={
                              MONTH_SHORT[cell.month - 1] + " · " +
                              (cell.isStart ? "portföye katıldı · " : "") +
                              info.title +
                              (cell.expected ? " · " + formatCurrency(cell.paid) + " / " + formatCurrency(cell.expected) : "")
                            }
                          >
                            {cell.isStart ? "◆" : info.text}
                          </span>
                        </td>
                      );
                    })}
                    <td className="matrix-total num">{formatCurrency(row.received)}</td>
                    <td className="matrix-rate num">%{row.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <WarningCircle weight="duotone" />
            <strong>{annual.year} için kayıt yok</strong>
            <span>Bu yıla ait kiracı ya da ödeme bulunmuyor.</span>
          </div>
        )}
        <p className="matrix-note">◆ kiracının portföye katıldığı ay</p>
      </article>

      {annual.dues?.rows.length ? (
        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Aidat × ay</p>
              <h2>{annual.year} aidat takibi</h2>
            </div>
            <div className="matrix-legend">
              <span className="matrix-key state-paid">Ö</span> ödendi
              <span className="matrix-key state-unpaid">·</span> ödenmedi
              <span className="matrix-key state-outside">–</span> kapsam dışı
            </div>
          </div>

          <div className="matrix-scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col" className="matrix-name">Daire / kalem</th>
                  <th scope="col" className="matrix-join">İlgili kiracı</th>
                  {MONTH_SHORT.map((label, index) => (
                    <th scope="col" key={label} className={index + 1 === currentMonth ? "is-now" : ""}>
                      {label}
                    </th>
                  ))}
                  <th scope="col" className="matrix-total">Ödenen</th>
                  <th scope="col" className="matrix-rate">Oran</th>
                </tr>
              </thead>
              <tbody>
                {annual.dues.rows.map((row) => (
                  <tr key={row.dueId}>
                    <th scope="row" className="matrix-name"><span>{row.label}</span></th>
                    <td className="matrix-join">{row.tenantName || "Genel"}</td>
                    {row.months.map((cell) => {
                      const state = cell.paid ? "paid" : !cell.covered ? "outside" : cell.status === "overdue" ? "unpaid" : "future";
                      const text = state === "paid" ? "Ö" : state === "outside" ? "–" : state === "unpaid" ? "·" : "";
                      return (
                        <td key={cell.month} className={"matrix-cell state-" + state}>
                          <span
                            title={
                              MONTH_SHORT[cell.month - 1] + " · " +
                              (cell.paid ? "ödendi" : !cell.covered ? "kapsam dışı" : cell.status === "overdue" ? "ödenmedi" : "sırada") +
                              " · " + formatCurrency(cell.amount)
                            }
                          >
                            {text}
                          </span>
                        </td>
                      );
                    })}
                    <td className="matrix-total num">{formatCurrency(row.settled)}</td>
                    <td className="matrix-rate num">%{row.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="matrix-note">
            {annual.dues.totals.paidMonths} ay ödendi ·{" "}
            {formatCurrency(annual.dues.totals.settled)} / {formatCurrency(annual.dues.totals.expected)} ·{" "}
            {formatCurrency(annual.dues.totals.outstanding)} açık
          </p>
        </article>
      ) : null}

      {annual.byCategory.length ? (
        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Gider kırılımı</p>
              <h2>{annual.year} masraf kalemleri</h2>
            </div>
          </div>
          <BarList
            items={annual.byCategory.map((item) => ({
              key: item.category,
              label: item.label,
              value: item.total,
              display: formatCurrency(item.total),
              tone: "warn",
            }))}
            empty="Bu yıl gider kaydı yok."
          />
        </article>
      ) : null}
    </div>
  );
}

/* ---------- Kayan dönem ---------- */

function RangeView({ report, months, busy, downloading, onRange, onSelectMonth, onOpenTenant, onPdf }) {
  if (!report) return <Loading label="Rapor hazırlanıyor" />;
  const totals = report.totals;

  function exportSeries() {
    downloadCsv(
      "vedat-gayrimenkul-son-" + report.months + "-ay.csv",
      ["Dönem", "Beklenen", "Tahsil edilen", "Gider", "Net", "Tahsilat oranı"],
      report.series.map((item) => [item.label, item.expected, item.received, item.expense, item.net, item.rate + "%"])
    );
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          Son {report.months} ay · {formatCurrency(totals.received)} tahsilat · net {formatCurrency(totals.net)}
        </p>
        <div className="view-actions">
          <div className="filters glass glass--chip" role="group" aria-label="Rapor aralığı">
            {RANGES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={"filter" + (months === value ? " is-active" : "")}
                onClick={() => onRange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn btn-glass btn-sm" type="button" onClick={exportSeries}>
            <DownloadSimple weight="bold" />
            CSV
          </button>
          <button
            className={"btn btn-primary btn-sm" + (downloading ? " is-busy" : "")}
            type="button"
            onClick={() => onPdf("range")}
          >
            <FilePdf weight="bold" />
            PDF indir
          </button>
        </div>
      </div>

      <div className="bento bento-4">
        <article className="tile glass" style={{ "--i": 0 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Toplam tahsilat</div>
          <div className="tile-value num">{formatCurrency(totals.received)}</div>
          <div className="spark tone-accent"><i style={{ width: totals.rate + "%" }} /></div>
          <p className="tile-meta">%{totals.rate} · beklenen {formatCurrency(totals.expected)}</p>
        </article>
        <article className="tile glass" style={{ "--i": 1 }}>
          <div className="tile-head"><ChartLineUp weight="duotone" />Net gelir</div>
          <div className={"tile-value num" + (totals.net >= 0 ? "" : " tone-bad")}>
            {formatCurrency(totals.net)}
          </div>
          <p className="tile-meta">{formatCurrency(totals.expense)} gider düşüldü</p>
        </article>
        <article className="tile glass" style={{ "--i": 2 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Aylık ortalama</div>
          <div className="tile-value num">{formatCurrency(totals.averageMonthly)}</div>
          <p className="tile-meta">{totals.bestMonth ? "En iyi: " + totals.bestMonth.label : "Veri yok"}</p>
        </article>
        <article className="tile glass" style={{ "--i": 3 }}>
          <div className="tile-head"><Vault weight="duotone" />Elde tutulan depozito</div>
          <div className="tile-value num">{formatCurrency(totals.deposits)}</div>
          <p className="tile-meta">Yıllık projeksiyon {formatCurrency(totals.annualProjection)}</p>
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Zaman içinde</p>
            <h2>Tahsilat ve gider</h2>
          </div>
        </div>
        <TrendChart series={report.series} onSelect={onSelectMonth} />
      </article>

      <div className="duo duo-even">
        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Kiracı bazında</p>
              <h2>Kim ne ödedi</h2>
            </div>
          </div>
          <BarList
            items={report.byTenant.map((item) => ({
              key: item.tenantId,
              label: item.name,
              value: item.received,
              display: formatCurrency(item.received),
              tone: item.rate >= 90 ? "ok" : item.rate >= 60 ? "warn" : "bad",
              meta: item.rate + "% tahsilat · " + formatCurrency(item.outstanding) + " açık",
            }))}
            empty="Bu aralıkta tahsilat yok."
          />
        </article>

        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Gider kırılımı</p>
              <h2>Masraf kalemleri</h2>
            </div>
          </div>
          <BarList
            items={report.byCategory.map((item) => ({
              key: item.category,
              label: item.label,
              value: item.total,
              display: formatCurrency(item.total),
              tone: "warn",
            }))}
            empty="Bu aralıkta gider kaydı yok."
          />
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Takvimde ne var</p>
            <h2>Sözleşme ve zam gündemi</h2>
          </div>
        </div>

        {report.agenda.length ? (
          <div className="feed">
            {report.agenda.map((item) => {
              const overdue = item.days < 0;
              const tone = overdue ? "bad" : item.days <= 30 ? "warn" : "calm";
              const Glyph = item.type === "contract" ? CalendarX : TrendUp;
              return (
                <button
                  type="button"
                  className="feed-item is-action"
                  key={item.type + item.tenantId}
                  onClick={() => onOpenTenant(item.tenantId)}
                >
                  <span className={"feed-mark tone-" + tone}><Glyph weight="fill" /></span>
                  <div className="feed-body">
                    <strong>{item.name}</strong>
                    <span>
                      {item.type === "contract"
                        ? "Sözleşme " + (overdue ? "bitti" : "bitiyor") + " · " + formatDate(item.date)
                        : "Kira yılı doluyor · " + formatDate(item.date)}
                      {item.type === "increase" && item.suggestedAmount
                        ? " · önerilen " + formatCurrency(item.suggestedAmount)
                        : ""}
                    </span>
                  </div>
                  <span className={"pill pill-" + tone}>
                    {overdue ? Math.abs(item.days) + " gün geçti" : item.days + " gün"}
                  </span>
                  <ArrowUpRight weight="bold" className="feed-go" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            <WarningCircle weight="duotone" />
            <strong>Yaklaşan bir şey yok</strong>
            <span>Sözleşme bitişi ya da kira yıldönümü yaklaşınca burada belirir.</span>
          </div>
        )}
      </article>
    </div>
  );
}

export default function ReportsView(props) {
  const { mode, onMode } = props;

  return (
    <>
      <div className="mode-switch">
        <div className="filters glass glass--chip" role="group" aria-label="Rapor türü">
          {[["range", "Dönem"], ["annual", "Yıllık"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={"filter" + (mode === key ? " is-active" : "")}
              onClick={() => onMode(key)}
              aria-pressed={mode === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "annual" ? <AnnualView {...props} /> : <RangeView {...props} />}
    </>
  );
}
