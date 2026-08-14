"use client";

import { useState, useTransition } from "react";
import {
  createReward,
  updateReward,
  toggleRewardActive,
} from "@/app/admin/actions";

const GLOW_COLORS = [
  { value: "", label: "Без свечения" },
  { value: "gold", label: "Золото" },
  { value: "purple", label: "Фиолет (легендарное)" },
  { value: "cyan", label: "Бирюза" },
  { value: "red", label: "Красное" },
];

const GLOW_STYLES = {
  gold: "0 0 24px rgba(250, 204, 21, 0.55)",
  purple: "0 0 24px rgba(168, 85, 247, 0.55)",
  cyan: "0 0 24px rgba(34, 211, 238, 0.55)",
  red: "0 0 24px rgba(248, 113, 113, 0.55)",
};

function toAlmatyDatetimeLocal(isoString) {
  if (!isoString) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default function RewardsAdminClient({ rewards, categories }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [createIsVariable, setCreateIsVariable] = useState(false);
  const [editIsVariable, setEditIsVariable] = useState(false);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await createReward(formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Награда добавлена");
        setShowCreate(false);
        setCreateIsVariable(false);
      }
    });
  }

  function handleUpdate(id, formData) {
    startTransition(async () => {
      const res = await updateReward(id, formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Обновлено");
        setEditingId(null);
      }
    });
  }

  function handleToggle(id, isActive) {
    startTransition(() => toggleRewardActive(id, !isActive));
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

      <p className="text-xs text-gray-600">
        Порядок внутри категории: чем меньше число — тем выше. Порядок самих
        категорий двигается кнопками ▲▼ выше.
      </p>

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="bg-acid-400 text-black font-bold rounded-xl px-4 py-2 text-sm"
        >
          + Добавить награду
        </button>
      ) : (
        <form
          action={handleCreate}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">Новая награда</p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-gray-500 text-sm"
            >
              Отмена
            </button>
          </div>
          <input
            name="title"
            required
            placeholder="Название"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <select
            name="category"
            required
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              name="is_variable"
              checked={createIsVariable}
              onChange={(e) => setCreateIsVariable(e.target.checked)}
            />
            Сотрудник сам вводит сумму в ₸ (например, пополнение Steam)
          </label>

          {createIsVariable ? (
            <div className="flex items-center gap-2">
              <input
                name="rate_coins"
                type="number"
                required
                placeholder="Coins"
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
              />
              <span className="text-gray-500 text-sm whitespace-nowrap">
                за каждые
              </span>
              <input
                name="rate_kzt"
                type="number"
                required
                placeholder="₸"
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
              />
            </div>
          ) : (
            <>
              <input
                name="price_coins"
                type="number"
                required
                placeholder="Цена в coins"
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
              />
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  Флеш-скидка (необязательно) — оставь пустым, если без скидки
                </p>
                <div className="flex items-center gap-2">
                  <input
                    name="sale_price_coins"
                    type="number"
                    placeholder="Цена со скидкой"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
                  />
                  <span className="text-gray-500 text-sm whitespace-nowrap">
                    до
                  </span>
                  <input
                    name="sale_ends_at"
                    type="datetime-local"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
              </div>
            </>
          )}
          <input
            name="sort_order"
            type="number"
            placeholder="Порядок внутри категории (0 = сначала)"
            defaultValue={0}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <select
            name="highlight_color"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          >
            {GLOW_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            name="description"
            placeholder="Описание (необязательно)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5"
          >
            Добавить
          </button>
        </form>
      )}

      <div className="space-y-2">
        {rewards.map((r) => (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4"
            style={
              r.highlight_color
                ? { boxShadow: GLOW_STYLES[r.highlight_color] }
                : undefined
            }
          >
            {editingId === r.id ? (
              <form
                action={(fd) => handleUpdate(r.id, fd)}
                className="space-y-2"
              >
                <input
                  name="title"
                  defaultValue={r.title}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  name="category"
                  defaultValue={r.category}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    name="is_variable"
                    checked={editIsVariable}
                    onChange={(e) => setEditIsVariable(e.target.checked)}
                  />
                  Сотрудник сам вводит сумму в ₸
                </label>

                {editIsVariable ? (
                  <div className="flex items-center gap-2">
                    <input
                      name="rate_coins"
                      type="number"
                      defaultValue={r.rate_coins ?? ""}
                      placeholder="Coins"
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                    />
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      за каждые
                    </span>
                    <input
                      name="rate_kzt"
                      type="number"
                      defaultValue={r.rate_kzt ?? ""}
                      placeholder="₸"
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <input
                      name="price_coins"
                      type="number"
                      defaultValue={r.price_coins ?? ""}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                    />
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Флеш-скидка (необязательно)
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          name="sale_price_coins"
                          type="number"
                          defaultValue={r.sale_price_coins ?? ""}
                          placeholder="Цена со скидкой"
                          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <span className="text-gray-500 text-xs whitespace-nowrap">
                          до
                        </span>
                        <input
                          name="sale_ends_at"
                          type="datetime-local"
                          defaultValue={toAlmatyDatetimeLocal(r.sale_ends_at)}
                          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={r.sort_order ?? 0}
                  placeholder="Порядок в категории"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  name="highlight_color"
                  defaultValue={r.highlight_color ?? ""}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {GLOW_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <textarea
                  name="description"
                  defaultValue={r.description}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {r.title}{" "}
                    {!r.is_active && (
                      <span className="text-xs text-gray-500">(скрыто)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.category} ·{" "}
                    {r.is_variable
                      ? `${r.rate_coins} coins за каждые ${r.rate_kzt} ₸`
                      : `${r.price_coins} coins`}{" "}
                    · порядок {r.sort_order ?? 0}
                    {r.highlight_color &&
                      ` · свечение: ${
                        GLOW_COLORS.find((c) => c.value === r.highlight_color)
                          ?.label
                      }`}
                  </p>
                  {r.sale_price_coins && r.sale_ends_at && (
                    <p className="text-xs text-red-400 mt-0.5">
                      🔥 Скидка {r.sale_price_coins} coins до{" "}
                      {new Date(r.sale_ends_at).toLocaleString("ru-RU", {
                        timeZone: "Asia/Almaty",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {new Date(r.sale_ends_at).getTime() < Date.now() &&
                        " (уже закончилась)"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditIsVariable(r.is_variable ?? false);
                      setEditingId(r.id);
                    }}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleToggle(r.id, r.is_active)}
                    disabled={isPending}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    {r.is_active ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
