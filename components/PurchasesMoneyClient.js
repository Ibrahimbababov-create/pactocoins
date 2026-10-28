"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MonthPicker from "@/components/MonthPicker";
import NameSearchInput from "@/components/NameSearchInput";
import EmptyState from "@/components/EmptyState";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { downloadCsv } from "@/lib/csv";
import { filterPurchases, purchaseTotals } from "@/lib/purchasesMoney";
import { updatePurchaseActualSpend } from "@/app/admin/budgetActions";
import { exportPurchasesCsv } from "@/app/admin/purchasesMoneyActions";

const money = (n) => Number(n ?? 0).toLocaleString("ru-RU");

function Stat({ label, value, hint, accent }) {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-display text-2xl tabular-nums break-words ${accent ? "text-acid-400" : ""}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function PurchasesMoneyClient({ months, monthKey, rows }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nameQuery, setNameQuery] = useState("");
  const [rewardQuery, setRewardQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState(null);

  const shown = filterPurchases(rows, nameQuery, rewardQuery);
  const t = purchaseTotals(shown);

  function say(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function saveAmount(id) {
    startTransition(async () => {
      const res = await updatePurchaseActualSpend(id, draft.trim());
      if (res?.error) return say(res.error, "error");
      setEditing(null);
      router.refresh();
    });
  }

  function download() {
    startTransition(async () => {
      const res = await exportPurchasesCsv(monthKey, nameQuery, rewardQuery);
      if (res?.error) return say(res.error, "error");
      downloadCsv(`покупки_${monthKey}.csv`, res.csv);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker months={months} selected={monthKey} />
        <button
          type="button"
          onClick={download}
          disabled={isPending || shown.length === 0}
          className="border border-dark-600 rounded-lg px-4 py-1.5 text-sm text-gray-200 disabled:opacity-40"
        >
          Скачать таблицей
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center ${
            message.type === "error" ? "bg-red-500/10 text-red-400" : "bg-acid-400/10 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Покупок" value={t.count} />
        <Stat label="Коинов списано" value={money(t.coins)} />
        <div className="col-span-2">
          <Stat
            accent
            label="Потрачено реально"
            value={`${money(t.fact)} ₸`}
            hint={
              t.estimateCount > 0
                ? `Ещё ≈ ${money(t.estimate)} ₸ оценочно: у ${t.estimateCount} без суммы. Всего ≈ ${money(t.total)} ₸`
                : "Все суммы внесены по факту"
            }
          />
        </div>
        {t.bothCount > 0 && (
          <div className="col-span-2">
            <Stat
              label="Оценка против факта"
              value={`${t.diff > 0 ? "+" : t.diff < 0 ? "-" : ""}${money(Math.abs(t.diff))} ₸`}
              hint={
                t.diff > 0
                  ? `Вышло дешевле оценки (по ${t.bothCount} покупкам с обеими суммами)`
                  : t.diff < 0
                  ? `Вышло дороже оценки (по ${t.bothCount} покупкам с обеими суммами)`
                  : `Совпало с оценкой (${t.bothCount} покупок)`
              }
            />
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <NameSearchInput value={nameQuery} onChange={setNameQuery} />
        <input
          type="search"
          value={rewardQuery}
          onChange={(e) => setRewardQuery(e.target.value)}
          placeholder="Найти награду по названию"
          aria-label="Поиск награды"
          className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-base text-white"
        />
      </div>

      {rows.length === 0 && <EmptyState icon="bag" title="В этом месяце покупок не было" />}
      {rows.length > 0 && shown.length === 0 && <EmptyState icon="bag" title="Ничего не нашлось" />}

      <div className="space-y-2">
        {shown.map((p) => {
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">
                    {p.rewards?.title}
                    {p.variant_label && (
                      <span className="text-gray-400 font-normal"> - {p.variant_label}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400 break-words">
                    {p.users?.name}
                    {p.users?.is_active === false ? " (уволен)" : ""} · {formatCoins(p.price_coins)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatDateTimeAlmaty(p.created_at)}
                    {p.reviewer?.name ? ` · одобрил: ${p.reviewer.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {p.actual_kzt_amount != null ? (
                    <p className="font-display text-lg tabular-nums text-acid-400">
                      {money(p.actual_kzt_amount)} ₸
                    </p>
                  ) : p.kzt_amount ? (
                    <p className="font-display text-lg tabular-nums text-gray-400">
                      ≈ {money(p.kzt_amount)} ₸
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">суммы нет</p>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Сколько потрачено, ₸"
                    className="w-40 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-base text-white"
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => saveAmount(p.id)}
                    className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="text-sm text-gray-400 px-2 py-2"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(p.id);
                    setDraft(p.actual_kzt_amount != null ? String(p.actual_kzt_amount) : "");
                  }}
                  className="text-xs text-acid-400"
                >
                  Изменить сумму
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
