"use client";

import { useRef, useState, useTransition, useMemo } from "react";
import Image from "next/image";
import {
  purchaseReward,
  purchaseVariableReward,
  purchaseRewardVariant,
  submitRewardSuggestion,
} from "@/app/mop/shop/actions";
import { uploadRewardSuggestionPhoto } from "@/lib/uploadRewardSuggestionPhoto";
import { getEffectivePrice } from "@/lib/rewardPricing";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";

const GLOW_STYLES = {
  gold: "0 0 24px rgba(250, 204, 21, 0.55)",
  purple: "0 0 24px rgba(168, 85, 247, 0.55)",
  cyan: "0 0 24px rgba(34, 211, 238, 0.55)",
  red: "0 0 24px rgba(248, 113, 113, 0.55)",
};

const GLOW_BORDERS = {
  gold: "border-yellow-400",
  purple: "border-purple-400",
  cyan: "border-cyan-400",
  red: "border-red-400",
};

function fmtCoins(n) {
  return Number(n || 0).toLocaleString("ru-RU");
}

// Иконка по ключевым словам в названии категории — чтобы новые категории
// из админки сразу получали иконку без ручной правки маппинга.
function categoryIcon(category) {
  const c = category.toLowerCase();
  if (c.includes("больш")) return "trophy";
  if (c.includes("техник") || c.includes("гаджет")) return "laptop";
  if (c.includes("достав")) return "gift";
  if (c.includes("еда") || c.includes("напит")) return "food";
  if (c.includes("машин")) return "car";
  if (c.includes("транспорт") || c.includes("бензин")) return "fuel";
  if (c.includes("сем")) return "users";
  if (c.includes("комфорт")) return "sparkle";
  if (c.includes("секрет") || c.includes("особ")) return "gift";
  if (c.includes("обучен") || c.includes("развит")) return "book";
  if (c.includes("красот")) return "sparkle";
  if (c.includes("мерч") || c.includes("аксессуар")) return "bag";
  if (c.includes("сертификат")) return "receipt";
  if (c.includes("привилег")) return "award";
  if (c.includes("опыт") || c.includes("развлечен")) return "sparkle";
  if (c.includes("подписк") || c.includes("сервис")) return "phone";
  if (c.includes("предложен")) return "sparkle";
  return "bag";
}

// Карточка с вариантами внутри (барбер по бюджету, сертификаты по номиналу
// и т.п.) — сначала выбираешь вариант строкой (название + своя цена сразу
// видна), потом обычный «Купить». Есть и «Копить на это» — цель просто
// запоминает, какой именно вариант выбрали.
function VariantCard({ reward, displayBalance, isPending, onBuy, onSetGoal, isPurchased }) {
  const [selected, setSelected] = useState(reward.variants[0]?.id ?? null);
  const [confirming, setConfirming] = useState(false);

  const variant = reward.variants.find((v) => v.id === selected) ?? reward.variants[0];
  const canAfford = variant ? displayBalance >= variant.price_coins : false;

  return (
    <div
      className={`group bg-dark-800 border rounded-2xl p-4 flex flex-col justify-between transition-colors hover:border-dark-500 ${
        reward.highlight_color ? GLOW_BORDERS[reward.highlight_color] : "border-dark-600"
      }`}
      style={
        reward.highlight_color
          ? { boxShadow: GLOW_STYLES[reward.highlight_color] }
          : undefined
      }
    >
      <div>
        {reward.image_url && (
          <div className="relative w-full h-24 rounded-lg mb-2 overflow-hidden bg-dark-700">
            <Image
              src={reward.image_url}
              alt=""
              fill
              sizes="(max-width: 500px) 45vw, 200px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}
        <p className="font-semibold text-sm leading-tight line-clamp-2">{reward.title}</p>
        {reward.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{reward.description}</p>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {reward.variants.map((v) => {
          const active = v.id === (variant?.id);
          return (
            <button
              key={v.id}
              onClick={() => {
                setSelected(v.id);
                setConfirming(false);
              }}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs border transition ${
                active
                  ? "bg-acid-400/15 border-acid-400 text-acid-400 font-bold"
                  : "border-dark-600 text-gray-400 hover:border-dark-500"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                    active ? "border-acid-400 bg-acid-400" : "border-dark-500"
                  }`}
                >
                  {active && <Icon name="check" className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                </span>
                <span className="truncate">{v.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">{fmtCoins(v.price_coins)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {isPurchased ? (
          <div
            className="w-full rounded-lg py-2 text-sm font-bold text-center bg-acid-400/10 text-acid-400 flex items-center justify-center gap-1.5"
            style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
            Куплено
          </div>
        ) : !confirming ? (
          <>
            <button
              disabled={!canAfford}
              onClick={() => {
                haptic.light();
                setConfirming(true);
              }}
              className="w-full rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black active:scale-[0.98] transition"
            >
              {canAfford
                ? `Купить за ${fmtCoins(variant?.price_coins)}`
                : `Не хватает ${fmtCoins((variant?.price_coins ?? 0) - displayBalance)}`}
            </button>
            <button
              onClick={() => onSetGoal(reward, variant)}
              disabled={isPending}
              className="w-full mt-1.5 rounded-lg py-1.5 text-xs text-gray-400 border border-dark-600 active:text-acid-400 active:border-acid-400 transition disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Icon name="target" className="w-3.5 h-3.5" />
              Копить на это
            </button>
          </>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => onBuy(reward, variant)}
              disabled={isPending}
              className="flex-1 rounded-lg py-2 text-xs font-bold bg-acid-400 text-black"
            >
              Точно?
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg py-2 text-xs bg-dark-700 text-gray-400"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestForm({ onDone }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState(null);
  const inputRef = useRef(null);

  function reset() {
    setTitle("");
    setPrice("");
    setDescription("");
    setPhoto(null);
  }

  function submit() {
    setMsg(null);
    startTransition(async () => {
      let imageUrl = null;
      if (photo) {
        setUploading(true);
        const up = await uploadRewardSuggestionPhoto(photo);
        setUploading(false);
        if (up.error) {
          setMsg(up.error);
          return;
        }
        imageUrl = up.url;
      }
      const res = await submitRewardSuggestion(title, price, description, imageUrl);
      if (res.error) {
        setMsg(res.error);
      } else {
        reset();
        setOpen(false);
        onDone();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-dark-600 py-3 text-sm text-gray-400 active:scale-[0.99] transition"
      >
        <Icon name="sparkle" className="w-4 h-4" />
        Предложить свою награду
      </button>
    );
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold">Предложить свою награду</p>
      <p className="text-xs text-gray-500">
        Админ увидит и решит — добавлять или нет.
      </p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
      />
      <input
        type="number"
        min="1"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Цена в коинах"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Описание (необязательно)"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs bg-dark-700 text-gray-300 rounded-lg px-3 py-2"
        >
          {uploading ? "Загрузка…" : photo ? `📎 ${photo.name}` : "📎 Фото"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setPhoto(f);
          }}
        />
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={pending || uploading || !title.trim() || !price}
          className="flex-1 rounded-lg py-2 text-sm font-bold bg-acid-400 text-black disabled:opacity-40"
        >
          {pending ? "Отправляю…" : "Отправить"}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg px-4 py-2 text-sm bg-dark-700 text-gray-400"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

export default function ShopClient({ grouped, balance }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(null);
  const [message, setMessage] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(balance);
  const [purchasedIds, setPurchasedIds] = useState(new Set());
  const [kztInputs, setKztInputs] = useState({});
  const [confirmingVariable, setConfirmingVariable] = useState(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null); // null = «Все»

  // Фильтрация чисто на клиенте — данные уже все на руках, без похода на сервер
  const filteredGrouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;

    const result = {};
    Object.entries(grouped).forEach(([category, items]) => {
      const matched = items.filter((r) =>
        r.title.toLowerCase().includes(q)
      );
      if (matched.length > 0) result[category] = matched;
    });
    return result;
  }, [grouped, query]);

  // Витрина: сразу плоская сетка товаров, категории — фильтр в одну строку,
  // а не гармошка, которую нужно по одной раскрывать.
  const visibleRewards = useMemo(() => {
    const entries = activeCategory
      ? [[activeCategory, filteredGrouped[activeCategory] ?? []]]
      : Object.entries(filteredGrouped);
    return entries.flatMap(([, items]) => items);
  }, [filteredGrouped, activeCategory]);

  function handleBuy(reward) {
    const { effectivePrice } = getEffectivePrice(reward);

    setConfirming(null);
    setDisplayBalance((prev) => prev - effectivePrice);
    setPurchasedIds((prev) => new Set([...prev, reward.id]));

    startTransition(async () => {
      const res = await purchaseReward(reward.id);
      if (res.error) {
        setDisplayBalance((prev) => prev + effectivePrice);
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          next.delete(reward.id);
          return next;
        });
        setMessage({ type: "error", text: res.error });
        haptic.error();
      } else {
        setMessage({ type: "success", text: `Куплено: ${reward.title}` });
        haptic.success();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleBuyVariant(reward, variant) {
    setDisplayBalance((prev) => prev - variant.price_coins);
    setPurchasedIds((prev) => new Set([...prev, reward.id]));

    startTransition(async () => {
      const res = await purchaseRewardVariant(variant.id);
      if (res.error) {
        setDisplayBalance((prev) => prev + variant.price_coins);
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          next.delete(reward.id);
          return next;
        });
        setMessage({ type: "error", text: res.error });
        haptic.error();
      } else {
        setMessage({ type: "success", text: `Куплено: ${reward.title} — ${variant.label}` });
        haptic.success();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleBuyVariable(reward) {
    const kzt = Number(kztInputs[reward.id]);
    if (!kzt || kzt <= 0) return;

    const coins = Math.ceil((kzt * reward.rate_coins) / reward.rate_kzt);

    setConfirmingVariable(null);
    setDisplayBalance((prev) => prev - coins);
    setPurchasedIds((prev) => new Set([...prev, reward.id]));

    startTransition(async () => {
      const res = await purchaseVariableReward(reward.id, kzt);
      if (res.error) {
        setDisplayBalance((prev) => prev + coins);
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          next.delete(reward.id);
          return next;
        });
        setMessage({ type: "error", text: res.error });
        haptic.error();
      } else {
        haptic.success();
        setMessage({
          type: "success",
          text: `Куплено: ${reward.title} — ${kzt.toLocaleString("ru-RU")} ₸`,
        });
        setKztInputs((prev) => ({ ...prev, [reward.id]: "" }));
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleSetGoal(reward, variant) {
    startTransition(async () => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id, variantId: variant?.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Не получилось поставить цель" });
        haptic.error();
      } else {
        const label = variant ? `${reward.title} — ${variant.label}` : reward.title;
        setMessage({ type: "success", text: `Цель поставлена: ${label}` });
        haptic.success();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  const categories = Object.keys(grouped);
  const isSearching = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 border border-dark-600 bg-dark-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black flex items-center gap-1.5">
              <Icon name="bag" className="w-5 h-5 text-acid-400 shrink-0" />
              Магазин наград
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Меняй коины на то, что реально хочешь
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              Баланс
            </p>
            <p className="text-2xl font-black text-acid-400 tabular-nums">
              {fmtCoins(displayBalance)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Icon
          name="search"
          className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по магазину..."
          className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-acid-400 transition"
        />
      </div>

      <SuggestForm
        onDone={() => {
          setMessage({ type: "success", text: "Отправлено, ждём решения админа" });
          setTimeout(() => setMessage(null), 3000);
        }}
      />

      {visibleRewards.length === 0 && (
        <EmptyState
          icon="search"
          title="Ничего не нашлось"
          hint={
            isSearching
              ? "Попробуй другой запрос или сбрось поиск."
              : "В этой категории пока нет наград."
          }
          action={
            <button
              onClick={() => {
                setQuery("");
                setActiveCategory(null);
              }}
              className="inline-block bg-acid-400 text-black font-bold rounded-xl px-5 py-2.5 text-sm active:scale-95"
            >
              Показать всё
            </button>
          }
        />
      )}

      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center font-medium ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
          style={{ animation: "levelup-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          {message.text}
        </div>
      )}

      {/* Категории — фильтр в одну строку, без раскрывающихся секций и без
          повторения этого же списка где-то ещё */}
      {!isSearching && (
        <div className="-mx-4 px-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={`whitespace-nowrap flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border active:scale-95 transition ${
                activeCategory === null
                  ? "bg-acid-400 text-black border-acid-400 font-semibold"
                  : "bg-dark-800 border-dark-600 text-gray-300"
              }`}
            >
              Все
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  setActiveCategory((c) => (c === category ? null : category))
                }
                className={`whitespace-nowrap flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border active:scale-95 transition ${
                  activeCategory === category
                    ? "bg-acid-400 text-black border-acid-400 font-semibold"
                    : "bg-dark-800 border-dark-600 text-gray-300"
                }`}
              >
                <Icon name={categoryIcon(category)} className="w-3.5 h-3.5" />
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleRewards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 items-stretch">
            {visibleRewards.map((reward) => {
              const isPurchased = purchasedIds.has(reward.id);
              const isConfirming = confirming === reward.id;

              const kztValue = kztInputs[reward.id] ?? "";
              const computedCoins = reward.is_variable
                ? Math.ceil(
                    (Number(kztValue) * reward.rate_coins) / reward.rate_kzt
                  )
                : 0;
              const { effectivePrice, saleActive } = getEffectivePrice(reward);
              const canAfford = reward.is_variable
                ? Number(kztValue) > 0 && displayBalance >= computedCoins
                : displayBalance >= effectivePrice;
              const isConfirmingVariable = confirmingVariable === reward.id;

              if (reward.variants && reward.variants.length > 0) {
                return (
                  <VariantCard
                    key={reward.id}
                    reward={reward}
                    displayBalance={displayBalance}
                    isPending={isPending}
                    isPurchased={isPurchased}
                    onBuy={handleBuyVariant}
                    onSetGoal={handleSetGoal}
                  />
                );
              }

              return (
                <div
                  key={reward.id}
                  className={`group bg-dark-800 border rounded-2xl p-4 flex flex-col justify-between transition-colors hover:border-dark-500 ${
                    reward.highlight_color
                      ? GLOW_BORDERS[reward.highlight_color]
                      : "border-dark-600"
                  }`}
                  style={
                    reward.highlight_color
                      ? { boxShadow: GLOW_STYLES[reward.highlight_color] }
                      : undefined
                  }
                >
                  <div>
                    {reward.image_url && (
                      <div className="relative w-full h-24 rounded-lg mb-2 overflow-hidden bg-dark-700">
                        <Image
                          src={reward.image_url}
                          alt=""
                          fill
                          sizes="(max-width: 500px) 45vw, 200px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <p className="font-semibold text-sm leading-tight line-clamp-2">
                      {reward.title}
                    </p>
                    {reward.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {reward.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3">
                    {reward.is_variable ? (
                      <>
                        <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                          <Icon name="coin" className="w-3.5 h-3.5" />
                          {reward.rate_coins} за каждые{" "}
                          {fmtCoins(reward.rate_kzt)} ₸
                        </p>

                        {isPurchased ? (
                          <div
                            className="w-full rounded-lg py-2 text-sm font-bold text-center bg-acid-400/10 text-acid-400 flex items-center justify-center gap-1.5"
                            style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
                          >
                            <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                            Куплено
                          </div>
                        ) : !isConfirmingVariable ? (
                          <>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={kztValue}
                              onChange={(e) =>
                                setKztInputs((prev) => ({
                                  ...prev,
                                  [reward.id]: e.target.value,
                                }))
                              }
                              placeholder="Сумма в ₸"
                              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-acid-400 transition"
                            />
                            {Number(kztValue) > 0 && (
                              <p className="text-acid-400 text-xs font-bold mt-1 tabular-nums">
                                = {fmtCoins(computedCoins)}
                              </p>
                            )}
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                haptic.light();
                                setConfirmingVariable(reward.id);
                              }}
                              className="w-full mt-2 rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black active:scale-[0.98] transition"
                            >
                              {Number(kztValue) > 0 && !canAfford
                                ? `Не хватает ${fmtCoins(computedCoins - displayBalance)}`
                                : "Купить"}
                            </button>
                          </>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBuyVariable(reward)}
                              disabled={isPending}
                              className="flex-1 rounded-lg py-2 text-xs font-bold bg-acid-400 text-black"
                            >
                              Точно? ({fmtCoins(computedCoins)})
                            </button>
                            <button
                              onClick={() => setConfirmingVariable(null)}
                              className="flex-1 rounded-lg py-2 text-xs bg-dark-700 text-gray-400"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {saleActive ? (
                          <p className="flex items-baseline gap-2">
                            <span className="text-gray-500 text-xs line-through">
                              {fmtCoins(reward.price_coins)}
                            </span>
                            <span className="text-red-400 font-bold tabular-nums">
                              {fmtCoins(effectivePrice)}
                            </span>
                          </p>
                        ) : (
                          <p className="text-acid-400 font-bold tabular-nums">
                            {fmtCoins(reward.price_coins)}
                          </p>
                        )}

                        {isPurchased ? (
                          <div
                            className="w-full mt-2 rounded-lg py-2 text-sm font-bold text-center bg-acid-400/10 text-acid-400 flex items-center justify-center gap-1.5"
                            style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
                          >
                            <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                            Куплено
                          </div>
                        ) : !isConfirming ? (
                          <>
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                haptic.light();
                                setConfirming(reward.id);
                              }}
                              className="w-full mt-2 rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black active:scale-[0.98] transition"
                            >
                              {canAfford
                                ? "Купить"
                                : `Не хватает ${fmtCoins(effectivePrice - displayBalance)}`}
                            </button>
                            <button
                              onClick={() => handleSetGoal(reward)}
                              disabled={isPending}
                              className="w-full mt-1.5 rounded-lg py-1.5 text-xs text-gray-400 border border-dark-600 active:text-acid-400 active:border-acid-400 transition disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <Icon name="target" className="w-3.5 h-3.5" />
                              Копить на это
                            </button>
                          </>
                        ) : (
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => handleBuy(reward)}
                              disabled={isPending}
                              className="flex-1 rounded-lg py-2 text-xs font-bold bg-acid-400 text-black"
                            >
                              Точно?
                            </button>
                            <button
                              onClick={() => setConfirming(null)}
                              className="flex-1 rounded-lg py-2 text-xs bg-dark-700 text-gray-400"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
}
