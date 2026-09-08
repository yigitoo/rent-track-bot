"use client";

import {
  ArrowUpRight,
  Bus,
  CalendarX,
  ChartLineUp,
  DownloadSimple,
  FilePdf,
  GasPump,
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

/* ---------- Otobüs hattı ---------- */

function BusReportView({ busReport, busPeriod, busy, downloading, onBusPeriod, onPdf }) {
  if (!busReport) return <Loading label="Otobüs raporu hazırlanıyor" />;
  const t = busReport.totals;

  function exportCsv() {
    downloadCsv(
      "otobus-" + busReport.year + "-" + String(busReport.month).padStart(2, "0") + ".csv",
      ["Gün", "Araç", "Toplam", "Mazot", "Yövmiye", "Denekçi", "Diğer", "Kalan", "Not"],
      busReport.rows.map((row) => [
        row.day, row.busNumber, row.gross, row.fuel, row.wage, row.fee, row.other, row.net, row.note || "",
      ])
    );
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          {busReport.label} · {t.days} gün · {formatCurrency(t.gross)} hasılat · {formatCurrency(t.net)} kalan
        </p>
        <div className="view-actions">
          <div className="period glass glass--chip">
            <button type="button" onClick={() => onBusPeriod(-1)} aria-label="Önceki ay">‹</button>
            <strong>{busReport.label}</strong>
            <button type="button" onClick={() => onBusPeriod(1)} aria-label="Sonraki ay">›</button>
          </div>
          <button className="btn btn-glass btn-sm" type="button" onClick={exportCsv}>
            <DownloadSimple weight="bold" />
            CSV
          </button>
          <button
            className={"btn btn-primary btn-sm" + (downloading ? " is-busy" : "")}
            type="button"
            onClick={() => onPdf("bus")}
          >
            <FilePdf weight="bold" />
            PDF indir
          </button>
        </div>
      </div>

      <div className="bento bento-4">
        <article className="tile glass tile-accent" style={{ "--i": 0 }}>
          <div className="tile-head"><Bus weight="duotone" />Toplam hasılat</div>
          <div className="tile-value num">{formatCurrency(t.gross)}</div>
          <p className="tile-meta">{t.days} gün · günlük ort. {formatCurrency(t.averageGross)}</p>
        </article>
        <article className="tile glass" style={{ "--i": 1 }}>
          <div className="tile-head"><GasPump weight="duotone" />Mazot</div>
          <div className="tile-value num">{formatCurrency(t.fuel)}</div>
          <p className="tile-meta">hasılatın %{t.gross ? Math.round((t.fuel / t.gross) * 100) : 0}&apos;i</p>
        </article>
        <article className="tile glass" style={{ "--i": 2 }}>
          <div className="tile-head"><ChartLineUp weight="duotone" />Toplam gider</div>
          <div className="tile-value num">{formatCurrency(t.expense)}</div>
          <p className="tile-meta">yövmiye {formatCurrency(t.wage)} · denekçi {formatCurrency(t.fee)}</p>
        </article>
        <article className="tile glass" style={{ "--i": 3 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Kalan</div>
          <div className={"tile-value num" + (t.net < 0 ? " tone-bad" : "")}>{formatCurrency(t.net)}</div>
          <div className="spark tone-accent"><i style={{ width: Math.max(Math.min(t.margin, 100), 0) + "%" }} /></div>
          <p className="tile-meta">kâr marjı %{t.margin} · günlük {formatCurrency(t.averageNet)}</p>
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Ay sonu dökümü</p>
            <h2>Gün gün kalemler</h2>
          </div>
          {t.missingDays ? (
            <span className="pill pill-warn">{t.missingDays} gün kayıtsız</span>
          ) : (
            <span className="pill pill-ok">Ay tamamlandı</span>
          )}
        </div>

        {busReport.rows.length ? (
          <div className="matrix-scroll">
            <table className="matrix bus-table">
              <thead>
                <tr>
                  <th scope="col">Gün</th>
                  <th scope="col">Araç</th>
                  <th scope="col">Toplam</th>
                  <th scope="col">Mazot</th>
                  <th scope="col">Yövmiye</th>
                  <th scope="col">Denekçi</th>
                  <th scope="col">Diğer</th>
                  <th scope="col">Kalan</th>
                </tr>
              </thead>
              <tbody>
                {busReport.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.day}</th>
                    <td>{row.busNumber}</td>
                    <td className="num">{formatCurrency(row.gross)}</td>
                    <td className="num">{row.fuel ? formatCurrency(row.fuel) : "—"}</td>
                    <td className="num">{row.wage ? formatCurrency(row.wage) : "—"}</td>
                    <td className="num">{row.fee ? formatCurrency(row.fee) : "—"}</td>
                    <td className="num">{row.other ? formatCurrency(row.other) : "—"}</td>
                    <td className={"num " + (row.net < 0 ? "tone-bad" : "tone-ok")}>{formatCurrency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Ay</th>
                  <td>{t.days} gün</td>
                  <td className="num">{formatCurrency(t.gross)}</td>
                  <td className="num">{formatCurrency(t.fuel)}</td>
                  <td className="num">{formatCurrency(t.wage)}</td>
                  <td className="num">{formatCurrency(t.fee)}</td>
                  <td className="num">{formatCurrency(t.other)}</td>
                  <td className={"num " + (t.net < 0 ? "tone-bad" : "tone-ok")}>{formatCurrency(t.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Bus weight="duotone" />
            <strong>Bu ay kayıt yok</strong>
            <span>Otobüs sayfasından gün gün kalemleri girin.</span>
          </div>
        )}
      </article>
    </div>
  );
}

/* ---------- Genel: kira + otobüs ---------- */

function CombinedView({ combined, months, busy, downloading, onRange, onPdf }) {
  if (!combined) return <Loading label="Genel rapor hazırlanıyor" />;
  const t = combined.totals;

  function exportCsv() {
    downloadCsv(
      "genel-rapor-son-" + combined.months + "-ay.csv",
      ["Dönem", "Kira beklenen", "Kira tahsilat", "Mülk gideri", "Otobüs hasılat", "Otobüs gider", "Otobüs kalan", "Net"],
      combined.series.map((item) => [
        item.label, item.rentExpected, item.rentReceived, item.expense, item.busGross, item.busExpense, item.busNet, item.net,
      ])
    );
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          Son {combined.months} ay · {formatCurrency(t.income)} gelir · net {formatCurrency(t.net)}
        </p>
        <div className="view-actions">
          <div className="filters glass glass--chip" role="group" aria-label="Dönem uzunluğu">
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
          <button className="btn btn-glass btn-sm" type="button" onClick={exportCsv}>
            <DownloadSimple weight="bold" />
            CSV
          </button>
          <button
            className={"btn btn-primary btn-sm" + (downloading ? " is-busy" : "")}
            type="button"
            onClick={() => onPdf("combined")}
          >
            <FilePdf weight="bold" />
            PDF indir
          </button>
        </div>
      </div>

      <div className="bento bento-4">
        <article className="tile glass tile-accent tile-wide" style={{ "--i": 0 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Toplam gelir</div>
          <div className="tile-value num">{formatCurrency(t.income)}</div>
          <p className="tile-meta">
            {formatCurrency(t.rentReceived)} kira · {formatCurrency(t.busGross)} otobüs
          </p>
        </article>
        <article className="tile glass" style={{ "--i": 1 }}>
          <div className="tile-head"><ChartLineUp weight="duotone" />Toplam gider</div>
          <div className="tile-value num">{formatCurrency(t.expense + t.busExpense)}</div>
          <p className="tile-meta">{formatCurrency(t.expense)} mülk · {formatCurrency(t.busExpense)} hat</p>
        </article>
        <article className="tile glass" style={{ "--i": 2 }}>
          <div className="tile-head"><Vault weight="duotone" />Birleşik net</div>
          <div className={"tile-value num" + (t.net < 0 ? " tone-bad" : "")}>{formatCurrency(t.net)}</div>
          <p className="tile-meta">aylık ortalama {formatCurrency(t.averageMonthly)}</p>
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">İki iş kolu</p>
            <h2>Aylara göre</h2>
          </div>
          <div className="matrix-legend">
            <span>Kira tahsilatı, otobüs kalanı ve birleşik net</span>
          </div>
        </div>
        <div className="matrix-scroll">
          <table className="matrix bus-table">
            <thead>
              <tr>
                <th scope="col">Dönem</th>
                <th scope="col">Kira beklenen</th>
                <th scope="col">Kira tahsilat</th>
                <th scope="col">Mülk gideri</th>
                <th scope="col">Otobüs hasılat</th>
                <th scope="col">Otobüs kalan</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {combined.series.map((item) => (
                <tr key={item.year + "-" + item.month}>
                  <th scope="row">{item.label}</th>
                  <td className="num">{formatCurrency(item.rentExpected)}</td>
                  <td className="num tone-accent">{formatCurrency(item.rentReceived)}</td>
                  <td className="num tone-warn">{formatCurrency(item.expense)}</td>
                  <td className="num">{formatCurrency(item.busGross)}</td>
                  <td className={"num " + (item.busNet < 0 ? "tone-bad" : "tone-ok")}>{formatCurrency(item.busNet)}</td>
                  <td className={"num " + (item.net < 0 ? "tone-bad" : "")}>{formatCurrency(item.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Toplam</th>
                <td className="num">{formatCurrency(t.rentExpected)}</td>
                <td className="num">{formatCurrency(t.rentReceived)}</td>
                <td className="num">{formatCurrency(t.expense)}</td>
                <td className="num">{formatCurrency(t.busGross)}</td>
                <td className="num">{formatCurrency(t.busNet)}</td>
                <td className={"num " + (t.net < 0 ? "tone-bad" : "tone-ok")}>{formatCurrency(t.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="matrix-note">
          Kira tahsilat oranı %{t.rentRate} · otobüs kâr marjı %{t.busMargin} · {t.busDays} gün işlendi
          {t.bestMonth ? " · en iyi ay " + t.bestMonth.label : ""}
        </p>
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
          {[["range", "Kira dönemi"], ["annual", "Kira yıllık"], ["bus", "Otobüs"], ["combined", "Genel"]].map(([key, label]) => (
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

      {mode === "annual" ? <AnnualView {...props} />
        : mode === "bus" ? <BusReportView {...props} />
          : mode === "combined" ? <CombinedView {...props} />
            : <RangeView {...props} />}
    </>
  );
}
