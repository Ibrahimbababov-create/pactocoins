"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { putChestGift, removeChestGift } from "@/app/admin/chestActions";
import { chipsNom, spinsNom, formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import EmployeePicker from "@/components/EmployeePicker";

function giftText(g) {
  return [
    g.coins > 0 && formatCoins(g.coins),
    g.chips > 0 && `${g.chips} ${chipsNom(g.chips)}`,
    g.spins > 0 && `${g.spins} ${spinsNom(g.spins)}`,
  ]
    .filter(Boolean)
    .join(" + ");
}

// Сундук в админке: положить подарок всем или одному человеку и
// посмотреть, кто открыл.
export default function ChestAdminClient({ gifts, eligibleCount, employees }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "Подарок от Pacto", chips: 20, spins: 0, coins: 0 });
  const [toOne, setToOne] = useState(false);
  const [userId, setUserId] = useState("");
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();

  const active = gifts.filter((g) => g.is_active);
  const past = gifts.filter((g) => !g.is_active).slice(0, 5);

  function put() {
    setMsg(null);
    start(async () => {
      if (toOne && !userId) {
        setMsg("Выбери, кому сундук");
        return;
      }
      const res = await putChestGift({ ...form, userId: toOne ? userId : null });
      setMsg(
        res?.error ?? (toOne ? "Положено. У человека на главной появился сундук" : "Положено. У всех на главной появился сундук")
      );
      router.refresh();
    });
  }

  function remove(id) {
    start(async () => {
      const res = await removeChestGift(id);
      if (res?.error) setMsg(res.error);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-acid-400/25 bg-gradient-to-br from-acid-400/10 to-dark-800 p-5 space-y-4">
      <div>
        <p className="font-bold">Сундук</p>
        <p className="text-sm text-gray-400 mt-1">
          Положи подарок, и на главной и в «Играх» появится сундук: у всех или у одного человека.
          Открыть можно один раз. Пока общий подарок лежит, его получат и новенькие; убери, когда
          хватит. Коины в сундуке настоящие и считаются в бюджете программы.
        </p>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Сейчас в сундуке</p>
          {active.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl border border-dark-600 bg-dark-800 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {g.title} · <span className="text-acid-400">{giftText(g)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {g.recipient
                    ? `для ${g.recipient} · ${g.claims > 0 ? "открыл" : "ещё не открыл"}`
                    : `открыли ${g.claims} из ${eligibleCount}`}{" "}
                  · положен {formatDateTimeAlmaty(g.created_at)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(g.id)}
                className="shrink-0 rounded-lg border border-dark-600 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-50"
              >
                Убрать
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-dark-600/60">
        <span className="text-xs text-gray-500">Кому</span>
        {[
          [false, "Всем"],
          [true, "Одному человеку"],
        ].map(([v, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setToOne(v)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              toOne === v ? "bg-acid-400 text-black font-bold" : "border border-dark-600 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {toOne && (
        <div className="max-w-sm">
          <EmployeePicker employees={employees} value={userId} onChange={setUserId} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500">
          Название
          <input
            value={form.title}
            maxLength={60}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-0.5 block w-56 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Коины
          <input
            type="number"
            min="0"
            max="5000"
            value={form.coins}
            onChange={(e) => setForm((f) => ({ ...f, coins: e.target.value }))}
            className="mt-0.5 block w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Фишки
          <input
            type="number"
            min="0"
            max="1000"
            value={form.chips}
            onChange={(e) => setForm((f) => ({ ...f, chips: e.target.value }))}
            className="mt-0.5 block w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-gray-500">
          Крутки
          <input
            type="number"
            min="0"
            max="50"
            value={form.spins}
            onChange={(e) => setForm((f) => ({ ...f, spins: e.target.value }))}
            className="mt-0.5 block w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
        <button
          type="button"
          onClick={put}
          disabled={pending}
          className="bg-acid-400 text-black font-bold rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Положить в сундук
        </button>
        {msg && <span className="text-xs text-acid-400">{msg}</span>}
      </div>

      {past.length > 0 && (
        <div className="space-y-1 pt-3 border-t border-dark-600/60">
          <p className="text-xs text-gray-500">Раньше</p>
          {past.map((g) => (
            <p key={g.id} className="text-xs text-gray-500">
              {g.title} · {giftText(g)}
              {g.recipient ? ` · для ${g.recipient}` : ""} · открыли {g.claims}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
