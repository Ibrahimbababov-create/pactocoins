-- ==========================================================
-- Награды с переменной суммой (например "Пополнение Steam") —
-- сотрудник сам вводит сумму в ₸, цена в coins считается по
-- курсу, который задаёт админ (rate_coins coins за rate_kzt ₸).
-- Выполнено напрямую через прямое подключение к БД.
-- ==========================================================

alter table public.rewards
  add column is_variable boolean not null default false,
  add column rate_coins integer,
  add column rate_kzt integer;

alter table public.rewards
  alter column price_coins drop not null;

alter table public.rewards
  drop constraint rewards_price_coins_check;

alter table public.rewards
  add constraint rewards_price_check check (
    (is_variable = false and price_coins > 0)
    or
    (is_variable = true and rate_coins > 0 and rate_kzt > 0)
  );

alter table public.purchase_requests
  add column kzt_amount integer;
