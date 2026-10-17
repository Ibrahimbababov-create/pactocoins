"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTournament, updateTournament } from "@/app/admin/tournamentActions";

const input =
  "block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white";

// datetime-local в Алматы из ISO.
function toLocal(iso) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5 * 3600000);
  return d.toISOString().slice(0, 16);
}

// Создание и правка турнира. Взнос можно поменять только до открытия записи.
export default function AdminTournamentForm({ tournament = null }) {
  const router = useRouter();
  const t = tournament;
  const [form, setForm] = useState({
    title: t?.title ?? "Турнир Clash Royale",
    description: t?.description ?? "",
    entry_fee: t?.entry_fee ?? 300,
    bonus_coins: t?.bonus_coins ?? 2000,
    max_players: t?.max_players ?? "",
    min_players: t?.min_players ?? 4,
    registration_ends_at: toLocal(t?.registration_ends_at),
    round_hours: t?.round_hours ?? 24,
    confirm_hours: t?.confirm_hours ?? 6,
    clan_tag: t?.clan_tag ?? "",
    is_test: t?.is_test ?? false,
  });
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();
  const feeLocked = t && t.status !== "draft";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  function submit(e) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = t ? await updateTournament(t.id, form) : await createTournament(form);
      if (res?.error) return setMsg({ error: res.error });
      if (!t && res.id) return router.push(`/admin/tournaments/${res.id}`);
      setMsg({ ok: "Сохранено" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
      <p className="font-semibold">{t ? "Настройки" : "Новый турнир"}</p>
      <label className="block text-xs text-gray-500">
        Название
        <input value={form.title} onChange={set("title")} className={input} />
      </label>
      <label className="block text-xs text-gray-500">
        Описание (необязательно)
        <textarea value={form.description} onChange={set("description")} rows={2} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-gray-500">
          Взнос, коинов
          <input
            value={form.entry_fee}
            onChange={set("entry_fee")}
            inputMode="numeric"
            disabled={feeLocked}
            className={`${input} disabled:opacity-50`}
          />
        </label>
        <label className="block text-xs text-gray-500">
          Pacto добавляет
          <input value={form.bonus_coins} onChange={set("bonus_coins")} inputMode="numeric" className={input} />
        </label>
        <label className="block text-xs text-gray-500">
          Мест (пусто — без лимита)
          <input value={form.max_players} onChange={set("max_players")} inputMode="numeric" className={input} />
        </label>
        <label className="block text-xs text-gray-500">
          Минимум игроков
          <input value={form.min_players} onChange={set("min_players")} inputMode="numeric" className={input} />
        </label>
        <label className="block text-xs text-gray-500">
          Часов на матч
          <input value={form.round_hours} onChange={set("round_hours")} inputMode="numeric" className={input} />
        </label>
        <label className="block text-xs text-gray-500">
          Часов на подтверждение
          <input value={form.confirm_hours} onChange={set("confirm_hours")} inputMode="numeric" className={input} />
        </label>
      </div>
      <label className="block text-xs text-gray-500">
        Запись до (Алматы)
        <input type="datetime-local" value={form.registration_ends_at} onChange={set("registration_ends_at")} className={input} />
      </label>
      <label className="block text-xs text-gray-500">
        Клан в игре (название или тег, необязательно)
        <input value={form.clan_tag} onChange={set("clan_tag")} placeholder="Pacto" className={input} />
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={form.is_test} onChange={set("is_test")} className="mt-1" />
        <span>
          Тестовый
          <span className="block text-xs text-gray-500">Видят только админы и участники, в группу ничего не уходит.</span>
        </span>
      </label>
      {feeLocked && <p className="text-xs text-gray-500">Взнос не меняется после открытия записи.</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-acid-400 text-black font-bold rounded-xl py-2.5 text-sm disabled:opacity-50"
      >
        {t ? "Сохранить" : "Создать черновик"}
      </button>
      {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
    </form>
  );
}
