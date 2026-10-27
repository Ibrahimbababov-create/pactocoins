"use client";

import { useState, useMemo, useTransition } from "react";
import { roleLabel } from "@/lib/roles";
import { matchesName } from "@/lib/translit";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  grantWheelSpins,
  createMop,
  updateMop,
  manualAdjustBalance,
  resetUserStats,
  offboardEmployee,
  reinstateEmployee,
  deleteEmployee,
} from "@/app/admin/actions";
import { graduateTrainee } from "@/app/mop/actions";

const GROUPS = [
  { key: "trainee", label: "Стажёры" },
  { key: "mop", label: "МОПы" },
  { key: "rop", label: "РОПы" },
  { key: "mentor", label: "Наставники" },
  { key: "observer", label: "Наблюдатели" },
  { key: "admin", label: "Админы" },
  { key: "test", label: "🤖 Тестовые (Claude)" },
  { key: "offboarded", label: "Уволенные" },
];

function groupOf(u) {
  if (u.email?.endsWith(".test@pactocoins.local")) return "test";
  if (!u.is_active) return "offboarded";
  if (u.role === "rop") return "rop";
  if (u.role === "mentor") return "mentor";
  if (u.role === "observer") return "observer";
  if (u.role === "admin") return "admin";
  if (u.role === "trainee") return "trainee";
  return "mop";
}

export default function EmployeesClient({ users, projects = [], mentors = [] }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustSpins, setAdjustSpins] = useState("");
  const [spinsForId, setSpinsForId] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [message, setMessage] = useState(null);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const q = query.trim();
  const qLower = q.toLowerCase().replace(/^@/, "");

  // Ищем по имени (и кириллицей, и латиницей), по email и telegram-нику.
  // Уволенные тоже находятся: они лежат в своей группе.
  const matched = useMemo(() => {
    if (!q) return users;
    return users.filter(
      (u) =>
        matchesName(u.name, q) ||
        (qLower &&
          [u.email, u.telegram_username].some((v) =>
            String(v ?? "").toLowerCase().includes(qLower)
          ))
    );
  }, [users, q, qLower]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(GROUPS.map((x) => [x.key, []]));
    for (const u of matched) g[groupOf(u)].push(u);
    return g;
  }, [matched]);

  const rops = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "rop" &&
          u.is_active &&
          !u.email?.endsWith(".test@pactocoins.local")
      ),
    [users]
  );
  const nameById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.name])),
    [users]
  );

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await createMop(formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Сотрудник создан");
        setShowCreate(false);
      }
    });
  }

  function handleUpdate(userId, formData) {
    startTransition(async () => {
      const res = await updateMop(userId, formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Обновлено");
        setEditingId(null);
      }
    });
  }

  // Крутки живут отдельно от коинов: баланс не трогают, поэтому и
  // выдаются своей кнопкой, а не через «Начислить».
  function handleSpins(userId, sign) {
    const count = Number(adjustSpins) * sign;
    if (!count) return showMessage("Сколько круток?", "error");

    startTransition(async () => {
      const res = await grantWheelSpins(userId, count, adjustReason);
      if (res?.error) return showMessage(res.error, "error");
      showMessage(
        sign > 0
          ? `Крутки выданы, теперь у него ${res.spins}`
          : `Крутки сняты, осталось ${res.spins}`
      );
      setAdjustSpins("");
      setAdjustReason("");
    });
  }

  function handleAdjust(userId, sign) {
    const amount = Number(adjustAmount) * sign;
    if (!amount) return;

    startTransition(async () => {
      const res = await manualAdjustBalance(userId, amount, adjustReason);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Баланс обновлён");
        setAdjustingId(null);
        setAdjustAmount("");
        setAdjustReason("");
      }
    });
  }

  function handleReset(userId, name) {
    const confirmed = window.confirm(
      `Сбросить все данные ${name}? Обнулит баланс, заработок и удалит его историю. Отменить нельзя.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await resetUserStats(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage("Данные сброшены");
    });
  }

  function handleGraduate(userId, name) {
    if (!window.confirm(`Допустить ${name}? Стажёр станет МОПом 1 уровня.`)) return;
    startTransition(async () => {
      const res = await graduateTrainee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} допущен`);
    });
  }

  function handleOffboard(userId, name) {
    const confirmed = window.confirm(
      `Уволить ${name}? Баланс обнулится, он пропадёт из рейтинга и списка активных. История (заявки, транзакции) сохранится — при необходимости можно восстановить.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await offboardEmployee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} уволен`);
    });
  }

  function handleDelete(userId, name) {
    if (
      !window.confirm(
        `Удалить ${name} НАВСЕГДА?\n\nСотрётся аккаунт и всё, что с ним связано: заявки, транзакции, история, прогресс обучения. Отменить нельзя. Уведомление человеку не придёт.`
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteEmployee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} удалён`);
    });
  }

  function handleReinstate(userId, name) {
    startTransition(async () => {
      const res = await reinstateEmployee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} восстановлен`);
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="bg-acid-400 text-black font-bold rounded-xl px-4 py-2 text-sm"
        >
          + Добавить сотрудника
        </button>
      ) : (
        <form
          action={handleCreate}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">Новый сотрудник</p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-gray-500 text-sm"
            >
              Отмена
            </button>
          </div>
          <input
            name="name"
            required
            placeholder="Имя"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <input
            name="password"
            type="text"
            required
            placeholder="Пароль (придумай сам)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <select
            name="role"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          >
            <option value="mop">МОП</option>
            <option value="trainee">Стажёр</option>
            <option value="rop">РОП</option>
            <option value="mentor">Наставник</option>
            <option value="admin">Админ</option>
            <option value="observer">Наблюдатель</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5"
          >
            Создать
          </button>
        </form>
      )}

      <div className="sticky top-0 z-20 bg-dark-900 py-2 -mx-1 px-1 space-y-1">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти сотрудника по имени"
            aria-label="Поиск сотрудника"
            className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-4 pr-10 py-2.5 text-base text-white [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-gray-500"
            >
              <Icon name="x" className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
        {q && (
          <p className="text-xs text-gray-500 px-1">
            Найдено: {matched.length}
          </p>
        )}
      </div>

      {q && matched.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6">
          Никого не нашлось. Попробуй часть имени или почту.
        </p>
      )}

      {GROUPS.map((g) => {
        const list = grouped[g.key];
        if (!list.length) return null;
        const isOpen = !!q || openGroups.has(g.key);
        return (
          <div
            key={g.key}
            className="border border-dark-600 rounded-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleGroup(g.key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-dark-800 hover:bg-dark-700 transition"
            >
              <span className="font-semibold text-sm">
                {g.label}{" "}
                <span className="text-gray-500 font-normal">· {list.length}</span>
              </span>
              <Icon
                name="chevronRight"
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="p-2 space-y-2 bg-dark-900/40">
                {list.map((u) => (
                  <div
                    key={u.id}
                    className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3"
                  >
            {editingId === u.id ? (
              <form
                action={(fd) => handleUpdate(u.id, fd)}
                className="space-y-2"
              >
                <input
                  name="name"
                  defaultValue={u.name}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="trainee">Стажёр</option>
                  <option value="mop">МОП</option>
                  <option value="rop">РОП</option>
                  <option value="admin">Админ</option>
                  <option value="mentor">Наставник</option>
                  <option value="observer">Наблюдатель</option>
                </select>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    Руководитель (РОП) — для МОПа
                  </span>
                  <select
                    name="rop_id"
                    defaultValue={u.rop_id ?? ""}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Не назначен</option>
                    {rops.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">Проект</span>
                  <select
                    name="project_id"
                    defaultValue={u.project_id ?? ""}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Не выбран</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.is_active ? "" : " (закрыт)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    Наставник — для стажёра
                  </span>
                  <select
                    name="mentor_id"
                    defaultValue={u.mentor_id ?? ""}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Не назначен</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    Множитель коинов (для тимлидов, 1 — обычный МОП)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    name="coin_rate_multiplier"
                    defaultValue={u.coin_rate_multiplier ?? 1}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    День рождения
                  </span>
                  <input
                    type="date"
                    name="birthday"
                    defaultValue={u.birthday ?? ""}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex-1 bg-dark-700 text-gray-400 rounded-lg py-2 text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.name}{" "}
                    <span className="text-xs text-gray-500">
                      ({roleLabel(u.role)})
                      {Number(u.coin_rate_multiplier) !== 1 && (
                        <span className="text-acid-400"> · x{u.coin_rate_multiplier}</span>
                      )}
                    </span>
                    {!u.is_active && (
                      <span className="ml-2 text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                        уволен
                      </span>
                    )}
                  </p>
                  {(u.role === "mop" || u.role === "trainee") && (
                    <p className="text-xs text-gray-500">
                      РОП: {u.rop_id ? nameById[u.rop_id] ?? "—" : "не назначен"}
                    </p>
                  )}
                  {u.role === "trainee" && u.onboarding && (
                    <p className="text-xs text-gray-500">
                      Обучение:{" "}
                      {[1, 2, 3]
                        .map(
                          (d) =>
                            `Д${d} ${u.onboarding.done?.[d] ?? 0}/${
                              u.onboarding.total?.[d] ?? 0
                            }`
                        )
                        .join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-500 mt-1 tabular-nums">
                    Баланс:{" "}
                    <span className="text-acid-400">
                      {u.balance.toLocaleString("ru-RU")}
                    </span>{" "}
                    · всего {u.total_earned.toLocaleString("ru-RU")} · месяц{" "}
                    {u.month_earned.toLocaleString("ru-RU")}
                  </p>
                  {u.goal ? (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-acid-400/10 text-acid-400 px-2 py-0.5 rounded-full">
                      <Icon name="target" className="w-3 h-3 shrink-0" />
                      {u.goal.rewards?.title ?? "награда"} ·{" "}
                      {Math.min(
                        100,
                        Math.round((u.balance / u.goal.target_amount) * 100)
                      )}
                      % из {u.goal.target_amount}
                    </span>
                  ) : (
                    <span className="inline-block mt-1.5 text-xs bg-dark-700 text-gray-500 px-2 py-0.5 rounded-full">
                      Цели нет
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/employees/${u.id}`}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    История
                  </Link>
                  <button
                    onClick={() => setEditingId(u.id)}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() =>
                      setAdjustingId(adjustingId === u.id ? null : u.id)
                    }
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Баланс
                  </button>
                  <button
                    onClick={() =>
                      setSpinsForId(spinsForId === u.id ? null : u.id)
                    }
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Крутки{(u.wheel_spins ?? 0) > 0 ? ` · ${u.wheel_spins}` : ""}
                  </button>
                  {u.role === "trainee" && u.is_active && (
                    <button
                      onClick={() => handleGraduate(u.id, u.name)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-xs font-bold bg-acid-400 text-black rounded-lg px-3 py-1.5"
                    >
                      <Icon name="award" className="w-3.5 h-3.5" />
                      Допустить
                    </button>
                  )}
                  <button
                    onClick={() => handleReset(u.id, u.name)}
                    disabled={isPending}
                    className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                  >
                    Сбросить
                  </button>
                  {u.is_active ? (
                    <button
                      onClick={() => handleOffboard(u.id, u.name)}
                      disabled={isPending}
                      className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                    >
                      Уволить
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReinstate(u.id, u.name)}
                      disabled={isPending}
                      className="text-xs bg-acid-400/10 text-acid-400 rounded-lg px-3 py-1.5"
                    >
                      Восстановить
                    </button>
                  )}
                  {u.role !== "admin" && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      disabled={isPending}
                      className="text-xs bg-red-600 text-white font-semibold rounded-lg px-3 py-1.5"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            )}

            {spinsForId === u.id && (
              <div className="border-t border-dark-600 pt-3 space-y-2">
                <p className="text-[11px] text-gray-500">
                  Крутки колеса считаются отдельно от коинов. Сейчас у него:{" "}
                  <span className="text-gray-300">{u.wheel_spins ?? 0}</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={adjustSpins}
                    onChange={(e) => setAdjustSpins(e.target.value)}
                    placeholder="Сколько круток"
                    className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={() => handleSpins(u.id, 1)}
                    disabled={isPending}
                    className="bg-acid-400/15 text-acid-400 font-bold rounded-lg px-3 py-2 text-sm"
                  >
                    + Выдать
                  </button>
                  <button
                    onClick={() => handleSpins(u.id, -1)}
                    disabled={isPending}
                    className="bg-red-500/10 text-red-400 rounded-lg px-3 py-2 text-sm"
                  >
                    −
                  </button>
                </div>
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="За что (уйдёт ему в сообщении)"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            )}

            {adjustingId === u.id && (
              <div className="border-t border-dark-600 pt-3 space-y-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Количество коинов"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Причина"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdjust(u.id, 1)}
                    disabled={isPending}
                    className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm"
                  >
                    + Начислить
                  </button>
                  <button
                    onClick={() => handleAdjust(u.id, -1)}
                    disabled={isPending}
                    className="flex-1 bg-red-500/20 text-red-400 font-bold rounded-lg py-2 text-sm"
                  >
                    − Списать
                  </button>
                </div>

              </div>
            )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
