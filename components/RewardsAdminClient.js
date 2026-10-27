"use client";

import { formatCoins } from "@/lib/plural";

import { useState, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  createReward,
  updateReward,
  toggleRewardActive,
  deleteHiddenRewards,
} from "@/app/admin/actions";
import Icon from "@/components/Icon";

const GLOW_COLORS = [
  { value: "", label: "Без пометки" },
  { value: "gold", label: "Золото" },
  { value: "purple", label: "Фиолет (легендарное)" },
  { value: "cyan", label: "Бирюза" },
  { value: "red", label: "Красное" },
];

// В админке цвет подсветки показываем тонкой полоской, без свечения.
const DOT_COLORS = {
  gold: "#FACC15",
  purple: "#A855F7",
  cyan: "#22D3EE",
  red: "#F87171",
};

const FIELD =
  "w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm";

// Сжимаем/уменьшаем фото на клиенте перед отправкой — награды могут
// грузить фото прямо с телефона, а это легко 5-10 МБ на файл.
// Карточки в магазине показывают фото маленьким (≈96px высотой), так что
// большое разрешение и высокое качество только тормозят загрузку.
// 700px / 0.7 — заметно легче файл, на глаз по картинкам разницы нет.
function compressImage(file, maxSize = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Не удалось обработать фото"));
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
            })
          );
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function handlePhotoChange(e) {
  const input = e.target;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const compressed = await compressImage(file);
    const dt = new DataTransfer();
    dt.items.add(compressed);
    input.files = dt.files;
  } catch {
    // Не получилось сжать — отправляем как есть, сервер всё равно проверит размер
  }
}

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


// Основная категория + дополнительные. Дополнительные выбираются в
// выпадающем списке с поиском, а не десятком чипов.
function CategoryPicker({ categories, initialMain, initialExtras, supported }) {
  const [main, setMain] = useState(initialMain ?? categories[0]?.name ?? "");
  const [extras, setExtras] = useState(initialExtras ?? []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  function toggleExtra(name) {
    setExtras((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  const chosen = extras.filter((n) => n !== main);
  const options = categories.filter(
    (c) =>
      c.name !== main && c.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="space-y-2">
      <select
        name="category"
        required
        value={main}
        onChange={(e) => setMain(e.target.value)}
        className={FIELD}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      {supported && categories.length > 1 && (
        <div>
          <input type="hidden" name="extras_supported" value="1" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-left"
          >
            <span className="min-w-0 truncate text-gray-300">
              {chosen.length > 0
                ? `Ещё в: ${chosen.join(", ")}`
                : "Ещё показывать в других категориях"}
            </span>
            <Icon
              name="chevronDown"
              className={`w-4 h-4 shrink-0 text-gray-500 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <div className="mt-1.5 rounded-lg border border-dark-600 bg-dark-800 p-2 space-y-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Найти категорию"
                className={FIELD}
              />
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {options.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-300 active:bg-dark-700"
                  >
                    <input
                      type="checkbox"
                      checked={extras.includes(c.name)}
                      onChange={() => toggleExtra(c.name)}
                    />
                    {c.name}
                  </label>
                ))}
                {options.length === 0 && (
                  <p className="text-xs text-gray-500 px-2 py-1">Не найдено</p>
                )}
              </div>
            </div>
          )}
          {chosen.map((n) => (
            <input key={n} type="hidden" name="extra_categories" value={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function pluralRewards(n) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return `${n} наград`;
  if (b === 1) return `${n} награда`;
  if (b >= 2 && b <= 4) return `${n} награды`;
  return `${n} наград`;
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap text-xs rounded-full px-3 py-1.5 border active:scale-95 transition ${
        active
          ? "bg-acid-400/15 border-acid-400 text-acid-400 font-semibold"
          : "bg-dark-700 border-dark-600 text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function RewardsAdminClient({ rewards, categories }) {
  // Колонка extra_categories есть в базе только после миграции
  const extrasSupported = rewards.some((r) => "extra_categories" in r);
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [createIsVariable, setCreateIsVariable] = useState(false);
  const [editIsVariable, setEditIsVariable] = useState(false);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null); // [{id,title}]

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await createReward(formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage(`Награда «${formData.get("title")}» добавлена`);
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
        showMessage(`Сохранено: «${formData.get("title")}»`);
        setEditingId(null);
      }
    });
  }

  function handleToggle(id, isActive) {
    startTransition(async () => {
      const res = await toggleRewardActive(id, !isActive);
      if (res?.error) showMessage(res.error, "error");
    });
  }

  function runDelete() {
    const ids = confirmDelete.map((r) => r.id);
    setConfirmDelete(null);
    startTransition(async () => {
      const res = await deleteHiddenRewards(ids);
      if (res.error) {
        showMessage(res.error, "error");
        return;
      }
      setSelected(new Set());
      if (res.kept.length > 0) {
        showMessage(
          `Удалено: ${res.deleted}. Не тронуты (по ним есть покупки или предложения, лучше оставить скрытыми): ${res.kept.join(", ")}`,
          res.deleted > 0 ? "success" : "error"
        );
      } else {
        showMessage(`Удалено: ${res.deleted}`);
      }
    });
  }

  const q = query.trim().toLowerCase();
  const matches = (r) =>
    (!q || (r.title ?? "").toLowerCase().includes(q)) &&
    (!catFilter ||
      r.category === catFilter ||
      (r.extra_categories ?? []).includes(catFilter));

  const activeAll = useMemo(() => rewards.filter((r) => r.is_active), [rewards]);
  const hiddenAll = useMemo(() => rewards.filter((r) => !r.is_active), [rewards]);

  const activeShown = status === "hidden" ? [] : activeAll.filter(matches);
  const hiddenShown = status === "active" ? [] : hiddenAll.filter(matches);

  // Группы по основной категории, в порядке категорий. При выборе категории
  // в фильтре: одна группа, куда попадают и награды с этой доп. категорией.
  const groups = [];
  if (catFilter) {
    if (activeShown.length > 0)
      groups.push({ name: catFilter, items: activeShown });
  } else {
    const byCat = new Map();
    for (const r of activeShown) {
      if (!byCat.has(r.category)) byCat.set(r.category, []);
      byCat.get(r.category).push(r);
    }
    for (const c of categories) {
      if (byCat.has(c.name)) {
        groups.push({ name: c.name, items: byCat.get(c.name) });
        byCat.delete(c.name);
      }
    }
    for (const [name, items] of byCat) {
      groups.push({ name: name || "Без категории", items });
    }
  }

  const searching = Boolean(q || catFilter);
  const groupOpen = (name) => searching || openGroups.has(name);
  const allOpen = groups.length > 0 && groups.every((g) => groupOpen(g.name));
  const showHiddenList = hiddenOpen || status === "hidden" || Boolean(q);

  function toggleGroup(name) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAllGroups() {
    setOpenGroups(allOpen ? new Set() : new Set(groups.map((g) => g.name)));
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedInView = hiddenShown.filter((r) => selected.has(r.id));
  const allHiddenSelected =
    hiddenShown.length > 0 && selectedInView.length === hiddenShown.length;

  function toggleSelectAllHidden() {
    setSelected(
      allHiddenSelected ? new Set() : new Set(hiddenShown.map((r) => r.id))
    );
  }

  function renderRow(r) {
    return (
      <div key={r.id} className="px-3 py-2.5">
        {editingId === r.id ? renderEditForm(r) : renderView(r)}
      </div>
    );
  }

  function renderView(r) {
    const dot = r.highlight_color ? DOT_COLORS[r.highlight_color] : null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {!r.is_active && (
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggleSelected(r.id)}
              aria-label={`Выбрать «${r.title}»`}
              className="shrink-0 w-4 h-4"
            />
          )}
          {dot && (
            <span
              className="shrink-0 w-1 self-stretch rounded-full"
              style={{ background: dot }}
              title={
                GLOW_COLORS.find((c) => c.value === r.highlight_color)?.label
              }
            />
          )}
          {r.image_url && (
            <img
              src={r.image_url}
              alt=""
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm break-words">{r.title}</p>
            <p className="text-xs text-gray-500">
              {[r.category, ...(r.extra_categories ?? [])].join(", ")} ·{" "}
              {r.is_variable
                ? `${formatCoins(r.rate_coins)} за каждые ${r.rate_kzt} ₸`
                : `${formatCoins(r.price_coins)}`}{" "}
              · порядок {r.sort_order ?? 0}
            </p>
            {r.sale_price_coins && r.sale_ends_at && (
              <p className="flex items-center gap-1 text-xs text-red-400 mt-0.5">
                <Icon name="fire" className="w-3.5 h-3.5 shrink-0" />
                Скидка {formatCoins(r.sale_price_coins)} до{" "}
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
        </div>
        <div className="flex flex-wrap gap-2">
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
          {!r.is_active && (
            <button
              onClick={() => setConfirmDelete([{ id: r.id, title: r.title }])}
              disabled={isPending}
              className="text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5"
            >
              Удалить навсегда
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderEditForm(r) {
    return (
      <form action={(fd) => handleUpdate(r.id, fd)} className="space-y-2">
        <input name="title" defaultValue={r.title} className={FIELD} />
        <CategoryPicker
          categories={categories}
          supported={extrasSupported}
          initialMain={r.category}
          initialExtras={r.extra_categories ?? []}
        />
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
              className={FIELD}
            />
            <span className="text-gray-500 text-xs whitespace-nowrap">
              за каждые
            </span>
            <input
              name="rate_kzt"
              type="number"
              defaultValue={r.rate_kzt ?? ""}
              placeholder="₸"
              className={FIELD}
            />
          </div>
        ) : (
          <>
            <input
              name="price_coins"
              type="number"
              defaultValue={r.price_coins ?? ""}
              placeholder="Цена в коинах"
              className={FIELD}
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
                  className={FIELD}
                />
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  до
                </span>
                <input
                  name="sale_ends_at"
                  type="datetime-local"
                  defaultValue={toAlmatyDatetimeLocal(r.sale_ends_at)}
                  className={FIELD}
                />
              </div>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            name="sort_order"
            type="number"
            defaultValue={r.sort_order ?? 0}
            placeholder="Порядок в категории"
            className={FIELD}
          />
          <select
            name="highlight_color"
            defaultValue={r.highlight_color ?? ""}
            className={FIELD}
          >
            {GLOW_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="description"
          rows={2}
          defaultValue={r.description}
          placeholder="Описание"
          className={FIELD}
        />
        <label className="block space-y-1">
          <span className="text-xs text-gray-500">
            {r.image_url ? "Заменить фото" : "Фото (необязательно)"}
          </span>
          <div className="flex items-center gap-2">
            {r.image_url && (
              <img
                src={r.image_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover shrink-0"
              />
            )}
            <input
              name="photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-dark-700 file:text-white file:text-sm"
            />
          </div>
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-60"
          >
            {isPending ? "Сохраняю..." : "Сохранить"}
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
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl p-3 text-sm text-center border ${
            message.type === "error"
              ? "bg-dark-800 border-red-500/40 text-red-400"
              : "bg-dark-800 border-acid-400/40 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Поиск и фильтры: прилипают к верху при прокрутке */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-dark-900 border-b border-dark-600 space-y-2">
        <div className="relative">
          <Icon
            name="search"
            className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти награду по названию"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            ["all", `Все · ${rewards.length}`],
            ["active", `Активные · ${activeAll.length}`],
            ["hidden", `Скрытые · ${hiddenAll.length}`],
          ].map(([v, label]) => (
            <Chip key={v} active={status === v} onClick={() => setStatus(v)}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          <Chip active={!catFilter} onClick={() => setCatFilter("")}>
            Все категории
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={catFilter === c.name}
              onClick={() => setCatFilter(catFilter === c.name ? "" : c.name)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

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
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-2"
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
          <input name="title" required placeholder="Название" className={FIELD} />
          <CategoryPicker categories={categories} supported={extrasSupported} />
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
                className={FIELD}
              />
              <span className="text-gray-500 text-sm whitespace-nowrap">
                за каждые
              </span>
              <input
                name="rate_kzt"
                type="number"
                required
                placeholder="₸"
                className={FIELD}
              />
            </div>
          ) : (
            <>
              <input
                name="price_coins"
                type="number"
                required
                placeholder="Цена в коинах"
                className={FIELD}
              />
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  Флеш-скидка (необязательно)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    name="sale_price_coins"
                    type="number"
                    placeholder="Цена со скидкой"
                    className={FIELD}
                  />
                  <span className="text-gray-500 text-sm whitespace-nowrap">
                    до
                  </span>
                  <input
                    name="sale_ends_at"
                    type="datetime-local"
                    className={FIELD}
                  />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              name="sort_order"
              type="number"
              placeholder="Порядок (0 = сначала)"
              defaultValue={0}
              className={FIELD}
            />
            <select name="highlight_color" className={FIELD}>
              {GLOW_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="description"
            rows={2}
            placeholder="Описание (необязательно)"
            className={FIELD}
          />
          <label className="block space-y-1">
            <span className="text-xs text-gray-500">Фото (необязательно)</span>
            <input
              name="photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-dark-700 file:text-white file:text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 disabled:opacity-60"
          >
            {isPending ? "Добавляю..." : "Добавить"}
          </button>
        </form>
      )}

      {/* Активные награды по категориям */}
      {status !== "hidden" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Порядок внутри категории: чем меньше число, тем выше.
            </p>
            {groups.length > 1 && !searching && (
              <button
                type="button"
                onClick={toggleAllGroups}
                className="shrink-0 text-xs text-gray-400 underline"
              >
                {allOpen ? "Свернуть все" : "Развернуть все"}
              </button>
            )}
          </div>
          {groups.map((g) => {
            const open = groupOpen(g.name);
            return (
              <div
                key={g.name}
                className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.name)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <span className="font-semibold text-sm">
                    {g.name}{" "}
                    <span className="text-gray-500 font-normal">
                      · {g.items.length}
                    </span>
                  </span>
                  <Icon
                    name="chevronDown"
                    className={`w-4 h-4 text-gray-500 ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="divide-y divide-dark-600 border-t border-dark-600">
                    {g.items.map(renderRow)}
                  </div>
                )}
              </div>
            );
          })}
          {groups.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">
              {searching ? "Ничего не нашлось" : "Активных наград нет"}
            </p>
          )}
        </div>
      )}

      {/* Скрытые награды: отдельный раздел */}
      {status !== "active" && hiddenAll.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setHiddenOpen((v) => !v)}
            aria-expanded={showHiddenList}
            className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
          >
            <span className="font-semibold text-sm">
              Скрытые ({hiddenAll.length})
              {hiddenShown.length !== hiddenAll.length && (
                <span className="text-gray-500 font-normal">
                  {" "}
                  · найдено {hiddenShown.length}
                </span>
              )}
            </span>
            <Icon
              name="chevronDown"
              className={`w-4 h-4 text-gray-500 ${showHiddenList ? "rotate-180" : ""}`}
            />
          </button>
          {showHiddenList && (
            <div className="border-t border-dark-600">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={allHiddenSelected}
                    onChange={toggleSelectAllHidden}
                  />
                  Выбрать все скрытые ({hiddenShown.length})
                </label>
                {selectedInView.length > 0 && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      setConfirmDelete(
                        selectedInView.map((r) => ({
                          id: r.id,
                          title: r.title,
                        }))
                      )
                    }
                    className="ml-auto flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                    Удалить выбранные ({selectedInView.length})
                  </button>
                )}
              </div>
              <div className="divide-y divide-dark-600 border-t border-dark-600">
                {hiddenShown.map(renderRow)}
                {hiddenShown.length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    Ничего не нашлось
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {confirmDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold">Точно удалить?</p>
              <p className="text-sm text-gray-400">
                {confirmDelete.length === 1
                  ? `Награда «${confirmDelete[0].title}» исчезнет навсегда.`
                  : `Навсегда исчезнет: ${pluralRewards(confirmDelete.length)}.`}{" "}
                Покупки в истории сохранятся. Если по награде уже были
                покупки, она не удалится, а останется скрытой.
              </p>
              {confirmDelete.length > 1 && (
                <ul className="max-h-32 overflow-y-auto text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                  {confirmDelete.map((r) => (
                    <li key={r.id}>{r.title}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={runDelete}
                  className="flex-1 bg-red-500 text-white font-bold rounded-lg py-2.5 text-sm"
                >
                  {confirmDelete.length === 1
                    ? "Удалить"
                    : `Удалить ${confirmDelete.length}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 bg-dark-700 text-gray-300 rounded-lg py-2.5 text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
