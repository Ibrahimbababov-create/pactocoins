-- ==========================================================
-- Флеш-скидки на награды (например "349 → 249 до 23:00 сегодня").
-- Действующая цена вычисляется на лету (sale_price_coins, пока
-- не прошёл sale_ends_at) — отдельного крона на "откат" цены не
-- нужно, после дедлайна просто снова действует price_coins.
-- Выполнено напрямую через подключение к БД.
-- ==========================================================

alter table public.rewards
  add column sale_price_coins integer,
  add column sale_ends_at timestamptz;

alter table public.rewards
  add constraint rewards_sale_price_check check (
    sale_price_coins is null or sale_price_coins > 0
  );
