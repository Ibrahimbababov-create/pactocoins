"use client";

import { useState, useTransition } from "react";
import {
  createReward,
  updateReward,
  toggleRewardActive,
} from "@/app/admin/actions";

export default function RewardsAdminClient({ rewards }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);

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
          <input
            name="category"
            required
            placeholder="Категория"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <input
            name="price_coins"
            type="number"
            required
            placeholder="Цена в coins"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
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
                <input
                  name="category"
                  defaultValue={r.category}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  name="price_coins"
                  type="number"
                  defaultValue={r.price_coins}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
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
                    {r.category} · {r.price_coins} coins
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(r.id)}
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
