-- ==========================================================
-- Общие копилки (funds)
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

create type fund_status as enum ('active', 'completed', 'closed');

create table public.funds (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  goal_coins integer not null check (goal_coins > 0),
  status fund_status not null default 'active',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.fund_contributions (
  id uuid primary key default uuid_generate_v4(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_coins integer not null check (amount_coins > 0),
  created_at timestamptz not null default now()
);

create index idx_fund_contributions_fund on public.fund_contributions(fund_id);
create index idx_fund_contributions_user on public.fund_contributions(user_id);

alter table public.funds enable row level security;
alter table public.fund_contributions enable row level security;

-- funds: читать может любой залогиненный (прозрачность), писать — только админ
create policy "funds_select" on public.funds
  for select using (auth.uid() is not null);
create policy "funds_write_admin" on public.funds
  for all using (public.is_admin());

-- fund_contributions: читать может любой залогиненный.
-- Insert/update/delete намеренно НЕ разрешены ни одной policy —
-- вставка идёт только через server action с service-role ключом
-- (contributeToFund в app/funds/actions.js), чтобы атомарно
-- проверить и списать баланс.
create policy "fund_contributions_select" on public.fund_contributions
  for select using (auth.uid() is not null);
