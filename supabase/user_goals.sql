-- ==========================================================
-- Личный план по балансу коинов (user_goals)
-- Выполняется через прямое подключение к БД, см. чат.
-- ==========================================================

create table public.user_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_amount integer not null check (target_amount > 0),
  deadline date not null,
  status text not null default 'active' check (status in ('active', 'achieved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, deadline)
);

create index idx_user_goals_user on public.user_goals(user_id);

alter table public.user_goals enable row level security;

create or replace function public.is_observer()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'observer'
  );
$$;

-- владелец видит и правит только свою запись; admin/observer видят все, но не правят чужие
create policy "user_goals_select" on public.user_goals
  for select using (
    user_id = auth.uid() or public.is_admin() or public.is_observer()
  );

create policy "user_goals_insert" on public.user_goals
  for insert with check (user_id = auth.uid());

create policy "user_goals_update" on public.user_goals
  for update using (user_id = auth.uid());
