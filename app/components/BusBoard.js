"use client";

import {
  Bus,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Gauge,
  GasPump,
  Plus,
  TrendUp,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";
import { downloadCsv, formatCurrency, formatMoneyShort } from "../lib/client";

const HAFTA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/* Otobüs hattının gün defteri. Takvim gibi: ayın her günü bir kutucuk,
   dokununca o günün Toplam / Mazot / Yövmiye / Denekçi kalemleri girilir. */
export default function BusBoard({
  data,
  busy,
  onShiftPeriod,
  onGoToday,
  onSelectBus,
  onOpenDay,
  onAddBus,
  onEditBus,
}) {
  if (!data) {
    return (
      <div className="view" aria-busy="true">
        <div className="empty">
          <Bus weight="duotone" />
          <strong>Hat defteri hazırlanıyor</strong>
          <span>Ayın günleri ve kalemler toplanıyor.</span>
        </div>
      </div>
    );
  }

  const t = data.totals;
  const secili = data.busId;

  const leading = (new Date(data.year, data.month - 1, 1).getDay() + 6) % 7;
  const hucreler = [
    ...Array.from({ length: leading }, () => null),
    ...data.days,
  ];
  while (hucreler.length % 7 !== 0) hucreler.push(null);

  function disaAktar() {
    const satirlar = [];
    for (const gun of data.days) {
      for (const kayit of gun.entries) {
        satirlar.push([
          gun.day,
          kayit.busNumber,
          kayit.gross,
          kayit.fuel,
          kayit.wage,
          kayit.fee,
          kayit.other,
          kayit.net,
          kayit.note || "",
        ]);
      }
    }
    if (!satirlar.length) return;
    downloadCsv(
      "otobus-" + data.year + "-" + String(data.month).padStart(2, "0") + ".csv",
      ["Gün", "Araç", "Toplam", "Mazot", "Yövmiye", "Denekçi", "Diğer", "Kalan", "Not"],
      satirlar
    );
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          {t.days} gün işlendi · {formatCurrency(t.gross)} hasılat · {formatCurrency(t.net)} kalan
        </p>
        <div className="view-actions">
          <div className="period glass glass--chip">
            <button type="button" onClick={() => onShiftPeriod(-1)} aria-label="Önceki ay">
              <CaretLeft weight="bold" />
            </button>
            <strong>{data.label}</strong>
            <button type="button" onClick={() => onShiftPeriod(1)} aria-label="Sonraki ay">
              <CaretRight weight="bold" />
            </button>
          </div>
          <button className="btn btn-quiet btn-sm" type="button" onClick={onGoToday}>Bugün</button>
          <button className="btn btn-glass btn-sm" type="button" onClick={disaAktar}>
            <DownloadSimple weight="bold" />
            Dışa aktar
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => onOpenDay(new Date().getDate())}>
            <Plus weight="bold" />
            Gün ekle
          </button>
        </div>
      </div>

      {data.buses.length ? (
        <div className="bus-chips" role="group" aria-label="Araç seçimi">
          <button
            type="button"
            className={"bus-chip" + (!secili ? " is-active" : "")}
            onClick={() => onSelectBus("")}
            aria-pressed={!secili}
          >
            Tüm araçlar
          </button>
          {data.perBus.map((bus) => (
            <button
              key={bus.id}
              type="button"
              className={"bus-chip" + (secili === bus.id ? " is-active" : "")}
              onClick={() => onSelectBus(secili === bus.id ? "" : bus.id)}
              onDoubleClick={() => onEditBus(bus)}
              aria-pressed={secili === bus.id}
              title={(bus.label || "") + (bus.plate ? " · " + bus.plate : "")}
            >
              <span className="bus-chip-no">{bus.number}</span>
              <span className="bus-chip-net num">{formatMoneyShort(bus.totals.net)}</span>
            </button>
          ))}
          <button className="bus-chip is-add" type="button" onClick={onAddBus}>
            <Plus weight="bold" />
            Araç
          </button>
        </div>
      ) : null}

      <div className="bento bento-4">
        <article className="tile glass tile-accent" style={{ "--i": 0 }}>
          <div className="tile-head"><Wallet weight="duotone" />Toplam hasılat</div>
          <div className="tile-value num">{formatCurrency(t.gross)}</div>
          <p className="tile-meta">{t.days} gün · günlük ort. {formatCurrency(t.days ? Math.round(t.gross / t.days) : 0)}</p>
        </article>
        <article className="tile glass" style={{ "--i": 1 }}>
          <div className="tile-head"><GasPump weight="duotone" />Mazot</div>
          <div className="tile-value num">{formatCurrency(t.fuel)}</div>
          <p className="tile-meta">hasılatın %{t.gross ? Math.round((t.fuel / t.gross) * 100) : 0}&apos;i</p>
        </article>
        <article className="tile glass" style={{ "--i": 2 }}>
          <div className="tile-head"><UsersThree weight="duotone" />Yövmiye + denekçi</div>
          <div className="tile-value num">{formatCurrency(t.wage + t.fee)}</div>
          <p className="tile-meta">{formatCurrency(t.wage)} yövmiye · {formatCurrency(t.fee)} denekçi</p>
        </article>
        <article className="tile glass" style={{ "--i": 3 }}>
          <div className="tile-head"><TrendUp weight="duotone" />Kalan</div>
          <div className={"tile-value num" + (t.net < 0 ? " tone-bad" : " tone-ok")}>{formatCurrency(t.net)}</div>
          <p className="tile-meta">kâr marjı %{t.gross ? Math.round((t.net / t.gross) * 100) : 0}</p>
        </article>
      </div>

      <article className="panel glass">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Gün defteri</p>
            <h2>{data.label}</h2>
          </div>
          <span className="bus-legend">Bir güne dokunun: kalemleri girin ya da düzeltin.</span>
        </div>

        <div className="cal-weekdays" aria-hidden="true">
          {HAFTA.map((gun) => <span key={gun}>{gun}</span>)}
        </div>

        <div className="bus-grid" role="grid" aria-label={data.label + " gün defteri"}>
          {hucreler.map((gun, index) => {
            if (!gun) return <div className="bus-cell is-empty" key={"bos-" + index} aria-hidden="true" />;
            const dolu = gun.entries.length > 0;
            const eksi = gun.totals.net < 0;
            return (
              <button
                key={gun.day}
                type="button"
                className={
                  "bus-cell" +
                  (dolu ? " is-filled" : "") +
                  (eksi ? " is-negative" : "") +
                  (gun.isToday ? " is-today" : "") +
                  (gun.isFuture ? " is-future" : "")
                }
                onClick={() => onOpenDay(gun.day)}
                aria-label={
                  gun.day + " " + data.label + " · " +
                  (dolu
                    ? formatCurrency(gun.totals.gross) + " hasılat, " + formatCurrency(gun.totals.net) + " kalan"
                    : "kayıt yok, eklemek için dokunun")
                }
                title={
                  dolu
                    ? "Toplam " + formatCurrency(gun.totals.gross) +
                      " · Mazot " + formatCurrency(gun.totals.fuel) +
                      " · Yövmiye " + formatCurrency(gun.totals.wage) +
                      " · Denekçi " + formatCurrency(gun.totals.fee) +
                      " · Kalan " + formatCurrency(gun.totals.net)
                    : "Kayıt yok"
                }
              >
                <span className="bus-cell-day">{gun.day}</span>
                {dolu ? (
                  <>
                    <span className="bus-cell-net num">{formatMoneyShort(gun.totals.net)}</span>
                    <span className="bus-cell-gross num">{formatMoneyShort(gun.totals.gross)}</span>
                  </>
                ) : (
                  <span className="bus-cell-add"><Plus weight="bold" /></span>
                )}
              </button>
            );
          })}
        </div>
      </article>

      {data.perBus.some((bus) => bus.totals.days > 0) ? (
        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Araç bazında</p>
              <h2>Bu ayın dökümü</h2>
            </div>
          </div>
          <div className="matrix-scroll">
            <table className="matrix bus-table">
              <thead>
                <tr>
                  <th scope="col">Araç</th>
                  <th scope="col">Gün</th>
                  <th scope="col">Toplam</th>
                  <th scope="col">Mazot</th>
                  <th scope="col">Yövmiye</th>
                  <th scope="col">Denekçi</th>
                  <th scope="col">Diğer</th>
                  <th scope="col">Kalan</th>
                </tr>
              </thead>
              <tbody>
                {data.perBus.filter((bus) => bus.totals.days > 0).map((bus) => (
                  <tr key={bus.id}>
                    <th scope="row">
                      <button type="button" onClick={() => onEditBus(bus)}>
                        {bus.number} numara{bus.label ? " · " + bus.label : ""}
                      </button>
                    </th>
                    <td className="num">{bus.totals.days}</td>
                    <td className="num">{formatCurrency(bus.totals.gross)}</td>
                    <td className="num">{formatCurrency(bus.totals.fuel)}</td>
                    <td className="num">{formatCurrency(bus.totals.wage)}</td>
                    <td className="num">{formatCurrency(bus.totals.fee)}</td>
                    <td className="num">{formatCurrency(bus.totals.other)}</td>
                    <td className={"num " + (bus.totals.net < 0 ? "tone-bad" : "tone-ok")}>
                      {formatCurrency(bus.totals.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Toplam</th>
                  <td className="num">{t.days}</td>
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
        </article>
      ) : (
        <div className="empty">
          <Gauge weight="duotone" />
          <strong>Bu ay henüz kayıt yok</strong>
          <span>
            {data.buses.length
              ? "Bir güne dokunup Toplam, Mazot, Yövmiye ve Denekçi kalemlerini girin."
              : "Önce bir araç ekleyin; kâğıttaki “No” numarası yeterli."}
          </span>
        </div>
      )}
    </div>
  );
}
