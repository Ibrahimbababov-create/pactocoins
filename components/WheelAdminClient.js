"use client";

import { useState, useTransition } from "react";
import {
  saveWheelSegment,
  deleteWheelSegment,
  saveWheelConfig,
  grantSpins,
  grantSpinsBulk,
} from "@/app/admin/wheelActions";
import { expectedPayoutCoins, PRIZE_TYPES, segmentColor } from "@/lib/wheel";

function SegmentRow({ seg, index, onDone }) {
  const [s, setS] = useState({
    label: seg.label ?? "",
    weight: seg.weight ?? 1,
    prize_type: seg.prize_type ?? "nothing",
    prize_amount: seg.prize_amount ?? 0,
    color: seg.color ?? "",
    sort_order: seg.sort_order ?? index,
    is_active: seg.is_active !== false,
  });
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveWheelSegment({ id: seg.id, ...s });
      setMsg(res?.error ? { t: "e", x: res.error } : { t: "ok", x: "Сохранено" });
      if (!res?.error) onDone?.();
    });
  }
  function remove() {
    if (!seg.id) return onDone?.();
    if (!confirm(`Удалить сектор «${s.label}»?`)) return;
    start(async () => {
      await deleteWheelSegment(seg.id);
      onDone?.();
    });
  }

  return (
    <div className="rounded-xl border border-dark-600 bg-dark-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded shrink-0"
          style={{ background: segmentColor(s, index) }}
        />
        <input
          value={s.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Название сектора"
          className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <input
            type="checkbox"
            checked={s.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          вкл
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="text-xs text-gray-500">
          Вес
          <input
            type="number"
            min="1"
            value={s.weight}
            onChange={(e) => set("weight", e.target.value)}
            className="mt-0.5 w-full bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Тип приза
          <select
            value={s.prize_type}
            onChange={(e) => set("prize_type", e.target.value)}
            className="mt-0.5 w-full bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          >
            {PRIZE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Размер приза
          <input
            type="number"
            min="0"
            value={s.prize_amount}
            onChange={(e) => set("prize_amount", e.target.value)}
            disabled={s.prize_type === "nothing" || s.prize_type === "custom"}
            className="mt-0.5 w-full bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white disabled:opacity-40"
          />
        </label>
        <label className="text-xs text-gray-500">
          Цвет (hex)
          <input
            value={s.color}
            onChange={(e) => set("color", e.target.value)}
            placeholder="#65a30d"
            className="mt-0.5 w-full bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={isPending}
          className="bg-acid-400 text-black font-bold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {seg.id ? "Сохранить" : "Добавить"}
        </button>
        {seg.id && (
          <button
            onClick={remove}
            disabled={isPending}
            className="text-red-400 text-sm px-2 py-1.5"
          >
            Удалить
          </button>
        )}
        {msg && (
          <span
            className={`text-xs ${
              msg.t === "e" ? "text-red-400" : "text-acid-400"
            }`}
          >
            {msg.x}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WheelAdminClient({
  segments,
  config,
  employees,
  recentSpins,
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const bump = () => setReloadKey((k) => k + 1);

  const [cfg, setCfg] = useState({
    spin_price_coins: config?.spin_price_coins ?? 500,
    buy_enabled: config?.buy_enabled ?? true,
  });
  const [cfgPending, startCfg] = useTransition();
  const [cfgMsg, setCfgMsg] = useState(null);

  const ev = expectedPayoutCoins(segments);

  // выдача круток
  const [singleId, setSingleId] = useState(employees[0]?.id ?? "");
  const [singleN, setSingleN] = useState(1);
  const [bulkIds, setBulkIds] = useState([]);
  const [bulkN, setBulkN] = useState(1);
  const [grantPending, startGrant] = useTransition();
  const [grantMsg, setGrantMsg] = useState(null);

  function saveCfg() {
    setCfgMsg(null);
    startCfg(async () => {
      const res = await saveWheelConfig(cfg);
      setCfgMsg(res?.error ? res.error : "Сохранено");
    });
  }

  return (
    <div className="space-y-6" key={reloadKey}>
      {/* Экономика */}
      <div className="rounded-2xl border border-acid-400/25 bg-gradient-to-br from-[#18220b] to-dark-800 p-5">
        <p className="font-bold">Экономика колеса</p>
        <p className="text-sm mt-1">
          В среднем одна крутка стоит компании{" "}
          <span className="text-acid-400 font-bold">{ev} coins</span>. Держи это
          ниже ценности действия, за которое выдаёшь крутку.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500">
            Цена покупки крутки, coins
            <input
              type="number"
              min="1"
              value={cfg.spin_price_coins}
              onChange={(e) =>
                setCfg((c) => ({ ...c, spin_price_coins: e.target.value }))
              }
              className="mt-0.5 block w-40 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={cfg.buy_enabled}
              onChange={(e) =>
                setCfg((c) => ({ ...c, buy_enabled: e.target.checked }))
              }
            />
            Разрешить покупку круток за coins
          </label>
          <button
            onClick={saveCfg}
            disabled={cfgPending}
            className="bg-acid-400 text-black font-bold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Сохранить
          </button>
          {cfgMsg && <span className="text-xs text-acid-400">{cfgMsg}</span>}
        </div>
      </div>

      {/* Сегменты */}
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Сектора колеса
        </p>
        {segments.map((seg, i) => (
          <SegmentRow key={seg.id} seg={seg} index={i} onDone={bump} />
        ))}
        <SegmentRow
          key={`new-${reloadKey}`}
          seg={{ sort_order: segments.length + 1 }}
          index={segments.length}
          onDone={bump}
        />
      </div>

      {/* Выдать крутки */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider">
            Выдать крутки одному
          </p>
          <select
            value={singleId}
            onChange={(e) => setSingleId(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={singleN}
            onChange={(e) => setSingleN(e.target.value)}
            placeholder="Сколько круток (можно минус)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() =>
              startGrant(async () => {
                const res = await grantSpins(singleId, singleN);
                setGrantMsg(res?.error || `Выдано: ${res.count}`);
              })
            }
            disabled={grantPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
          >
            Выдать
          </button>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider">
            Выдать крутки нескольким
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-dark-700 border border-dark-600 rounded-lg p-2">
            {employees.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-sm py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={bulkIds.includes(e.id)}
                  onChange={() =>
                    setBulkIds((p) =>
                      p.includes(e.id)
                        ? p.filter((x) => x !== e.id)
                        : [...p, e.id]
                    )
                  }
                />
                {e.name}
              </label>
            ))}
          </div>
          <input
            type="number"
            value={bulkN}
            onChange={(e) => setBulkN(e.target.value)}
            placeholder="Сколько круток каждому"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() =>
              startGrant(async () => {
                const res = await grantSpinsBulk(bulkIds, bulkN);
                setGrantMsg(res?.error || `Выдано: ${res.count} чел.`);
              })
            }
            disabled={grantPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
          >
            Выдать выбранным ({bulkIds.length})
          </button>
        </div>
      </div>
      {grantMsg && (
        <p className="text-sm text-acid-400 text-center">{grantMsg}</p>
      )}

      {/* Последние прокрутки */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Последние прокрутки
        </p>
        {(recentSpins ?? []).length === 0 && (
          <p className="text-sm text-gray-500">Пока никто не крутил.</p>
        )}
        {(recentSpins ?? []).map((sp) => (
          <div
            key={sp.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex items-center justify-between text-sm"
          >
            <span>
              <span className="font-semibold">{sp.user_name}</span>
              <span className="text-gray-500">
                {" "}
                · {sp.segment_label}
              </span>
            </span>
            <span className="text-xs text-gray-600">
              {new Date(sp.created_at).toLocaleString("ru-RU")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
