-- ==========================================================
-- Бюджет на закуп (реальные тенге, отдельно от coins)
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

-- Сколько реально было заплачено в магазине за конкретную заявку.
-- Отдельно от purchase_requests.kzt_amount — то поле это расчётная
-- сумма по внутреннему курсу для "переменных" наград, а не то, что
-- админ реально отдал в кассе.
alter table public.purchase_requests add column actual_kzt_amount integer;

-- Пополнения бюджета — когда админу выдали деньги на закуп подарков/наград.
create table public.budget_topups (
  id uuid primary key default uuid_generate_v4(),
  amount_kzt integer not null check (amount_kzt > 0),
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.budget_topups enable row level security;

-- Бюджет — деньги, это видит и пишет только админ.
create policy "budget_topups_admin" on public.budget_topups
  for all using (public.is_admin());
