"use client";

import { useState } from "react";
import { ArrowsClockwise, Plus, Receipt, Trash, Wallet } from "@phosphor-icons/react";
import { BarList } from "./Charts";
import { apiRequest, formatCurrency, formatDate } from "../lib/client";

export default function ExpensesView({
  data,
  expenses,
  planned = [],
  recurrences = [],
  categories,
  busy,
  token,
  onAdd,
  onAddRecurrence,
  onChanged,
  onError,
}) {
  const [removing, setRemoving] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [filter, setFilter] = useState("all");

  const labelOf = (value) => categories.find((item) => item.value === value)?.label || "Diğer";
  const visible = filter === "all" ? expenses : expenses.filter((item) => item.category === filter);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  const byCategory = categories
    .map((category) => ({
      key: category.value,
      label: category.label,
      value: expenses.filter((item) => item.category === category.value).reduce((sum, item) => sum + item.amount, 0),
      tone: "warn",
    }))
    .filter((item) => item.value > 0)
    .map((item) => ({ ...item, display: formatCurrency(item.value) }))
    .sort((a, b) => b.value - a.value);

  const usedCategories = categories.filter((category) =>
    expenses.some((item) => item.category === category.value)
  );

  async function remove(expense) {
    if (!window.confirm(expense.title + " gideri silinsin mi?")) return;
    setRemoving(expense.id);
    try {
      await apiRequest("/api/expenses?id=" + expense.id, { method: "DELETE" }, token);
      onChanged("Gider kaydı silindi.");
    } catch (error) {
      onError(error.message);
    } finally {
      setRemoving("");
    }
  }

  async function toggle(item) {
    setTogglingId(item.id);
    try {
      await apiRequest("/api/recurrences?id=" + item.id, { method: "PATCH" }, token);
      onChanged(item.isActive ? "Düzenli kalem duraklatıldı." : "Düzenli kalem yeniden başlatıldı.");
    } catch (error) {
      onError(error.message);
    } finally {
      setTogglingId("");
    }
  }

  async function removeRecurrence(item) {
    if (!window.confirm(item.title + " düzenli kalemi silinsin mi? Geçmiş kayıtlar kalır.")) return;
    try {
      await apiRequest("/api/recurrences?id=" + item.id, { method: "DELETE" }, token);
      onChanged("Düzenli kalem silindi.");
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <div className="view" data-busy={busy} aria-busy={busy}>
      <div className="view-bar">
        <p className="view-summary">
          {formatCurrency(total)} gider · net {formatCurrency(data.metrics.netIncome)}
        </p>
        <div className="view-actions">
          {usedCategories.length > 1 ? (
            <div className="filters glass glass--chip" role="group" aria-label="Gider kategorisi">
              <button
                type="button"
                className={"filter" + (filter === "all" ? " is-active" : "")}
                onClick={() => setFilter("all")}
              >
                Tümü
              </button>
              {usedCategories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  className={"filter" + (filter === category.value ? " is-active" : "")}
                  onClick={() => setFilter(category.value)}
                >
                  {category.label}
                </button>
              ))}
            </div>
          ) : null}
          <button className="btn btn-glass btn-sm" type="button" onClick={onAddRecurrence}>
            <ArrowsClockwise weight="bold" />
            Düzenli gider
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onAdd}>
            <Plus weight="bold" />
            Gider ekle
          </button>
        </div>
      </div>

      <div className="duo">
        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Dönem defteri</p>
              <h2>Giderler</h2>
            </div>
            <span className="pill pill-warn">{formatCurrency(total)}</span>
          </div>

          <div className="feed">
            {visible.length ? (
              visible.map((expense) => (
                <div className="feed-item" key={expense.id}>
                  <span className={"feed-mark tone-" + (expense.paid === false ? "bad" : "warn")}><Receipt weight="fill" /></span>
                  <div className="feed-body">
                    <strong>{expense.title}</strong>
                    <span>
                      {labelOf(expense.category)} · {formatDate(expense.date)}
                      {expense.tenantName ? " · " + expense.tenantName : ""}
                      {expense.paid === false ? " · ödenmedi" : ""}
                      {expense.note ? " · " + expense.note : ""}
                    </span>
                  </div>
                  <span className="feed-side num">{formatCurrency(expense.amount)}</span>
                  <button
                    className={"icon-btn is-danger" + (removing === expense.id ? " is-busy" : "")}
                    type="button"
                    onClick={() => remove(expense)}
                    aria-label={expense.title + " giderini sil"}
                  >
                    <Trash weight="bold" />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty">
                <Wallet weight="duotone" />
                <strong>{expenses.length ? "Bu kategoride kayıt yok" : "Bu dönemde gider yok"}</strong>
                <span>Aidat, tamir ya da vergi girdikçe net gelir kendiliğinden hesaplanır.</span>
              </div>
            )}
          </div>
        </article>

        <article className="panel glass">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Kırılım</p>
              <h2>Nereye gitti</h2>
            </div>
          </div>
          <BarList items={byCategory} empty="Henüz gider kaydı yok." />

          {recurrences.length ? (
            <div className="recurring">
              <p className="strip-title">Düzenli kalemler</p>
              {recurrences.map((item) => {
                const isPlanned = planned.some((entry) => entry.id === item.id);
                return (
                  <div className={"recurring-item" + (item.isActive ? "" : " is-off")} key={item.id}>
                    <span className="feed-mark tone-calm"><ArrowsClockwise weight="fill" /></span>
                    <div className="feed-body">
                      <strong>{item.title}</strong>
                      <span>
                        Her ayın {item.dayOfMonth}. günü · {labelOf(item.category)}
                        {item.isActive ? (isPlanned ? " · bu ay bekliyor" : " · bu ay işlendi") : " · duraklatıldı"}
                      </span>
                    </div>
                    <span className="feed-side num">{formatCurrency(item.amount)}</span>
                    <button
                      className={"icon-btn" + (togglingId === item.id ? " is-busy" : "")}
                      type="button"
                      onClick={() => toggle(item)}
                      aria-label={item.isActive ? "Duraklat" : "Yeniden başlat"}
                      title={item.isActive ? "Duraklat" : "Yeniden başlat"}
                    >
                      <ArrowsClockwise weight="bold" />
                    </button>
                    <button
                      className="icon-btn is-danger"
                      type="button"
                      onClick={() => removeRecurrence(item)}
                      aria-label={item.title + " düzenli kalemini sil"}
                    >
                      <Trash weight="bold" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="net-box">
            <div>
              <span>Tahsilat</span>
              <strong className="num tone-ok">{formatCurrency(data.metrics.totalReceived)}</strong>
            </div>
            <div>
              <span>Gider</span>
              <strong className="num tone-warn">{formatCurrency(total)}</strong>
            </div>
            <div className="net-box-total">
              <span>Net gelir</span>
              <strong className={"num " + (data.metrics.netIncome >= 0 ? "tone-ok" : "tone-bad")}>
                {formatCurrency(data.metrics.netIncome)}
              </strong>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
