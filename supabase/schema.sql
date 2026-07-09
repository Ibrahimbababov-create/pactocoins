-- ==========================================================
-- PactoCoins — Supabase schema
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

-- Расширения
create extension if not exists "uuid-ossp";

-- ==========================================================
-- ENUM типы
-- ==========================================================
create type user_role as enum ('admin', 'mop');
create type request_status as enum ('pending', 'approved', 'rejected');
create type purchase_status as enum ('pending', 'approved', 'done', 'rejected');
create type transaction_type as enum ('earn', 'spend', 'manual_add', 'manual_subtract');

-- ==========================================================
-- Таблица users
-- Связана с auth.users через id (используем Supabase Auth)
-- ==========================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'mop',
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0,
  month_earned integer not null default 0,
  month_key text not null default to_char(now(), 'YYYY-MM'), -- для сброса month_earned помесячно
  created_at timestamptz not null default now()
);

-- ==========================================================
-- revenue_requests — заявки на выручку
-- ==========================================================
create table public.revenue_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount_kzt integer not null check (amount_kzt > 0),
  calculated_coins integer not null,
  comment text,
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

-- ==========================================================
-- transactions — все движения коинов
-- ==========================================================
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  type transaction_type not null,
  amount_coins integer not null, -- положительное = начисление, отрицательное = списание
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

-- ==========================================================
-- rewards — магазин наград
-- ==========================================================
create table public.rewards (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null,
  price_coins integer not null check (price_coins > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ==========================================================
-- purchase_requests — заявки на покупку наград
-- ==========================================================
create table public.purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_id uuid not null references public.rewards(id),
  price_coins integer not null,
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- Индексы
-- ==========================================================
create index idx_revenue_requests_user on public.revenue_requests(user_id);
create index idx_transactions_user on public.transactions(user_id);
create index idx_purchase_requests_user on public.purchase_requests(user_id);

-- ==========================================================
-- RLS (Row Level Security)
-- ==========================================================
alter table public.users enable row level security;
alter table public.revenue_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.purchase_requests enable row level security;

-- helper: проверка что текущий юзер — admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- users: сам себя видит всегда, admin видит всех
create policy "users_select" on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy "users_update_admin" on public.users
  for update using (public.is_admin());
create policy "users_insert_admin" on public.users
  for insert with check (public.is_admin());

-- revenue_requests: mop видит свои, admin видит все
create policy "revenue_select" on public.revenue_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "revenue_insert" on public.revenue_requests
  for insert with check (user_id = auth.uid());
create policy "revenue_update_admin" on public.revenue_requests
  for update using (public.is_admin());

-- transactions: mop видит свои, admin видит все
create policy "transactions_select" on public.transactions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "transactions_insert_admin" on public.transactions
  for insert with check (public.is_admin() or user_id = auth.uid());

-- rewards: все залогиненные видят активные, admin видит и правит все
create policy "rewards_select" on public.rewards
  for select using (is_active = true or public.is_admin());
create policy "rewards_write_admin" on public.rewards
  for all using (public.is_admin());

-- purchase_requests: mop видит свои и создаёт, admin видит все и правит
create policy "purchase_select" on public.purchase_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "purchase_insert" on public.purchase_requests
  for insert with check (user_id = auth.uid());
create policy "purchase_update_admin" on public.purchase_requests
  for update using (public.is_admin());

-- ==========================================================
-- SEED DATA
-- ⚠️ Важно: сначала создай пользователей через Supabase Auth
-- (Authentication > Users > Add user), затем вставь их сюда,
-- подставив реальные UUID из auth.users.
-- Ниже — шаблон, id нужно заменить после создания auth-юзеров.
-- ==========================================================

-- Пример (замени 'UUID_ADMIN', 'UUID_MOP1' и т.д. на реальные id из auth.users):
-- insert into public.users (id, name, email, role, balance, total_earned, month_earned) values
--   ('UUID_ADMIN', 'Админ Кямран', 'admin@pacto.kz', 'admin', 0, 0, 0),
--   ('UUID_MOP1', 'Данияр', 'daniyar@pacto.kz', 'mop', 1200, 5000, 1200),
--   ('UUID_MOP2', 'Дильнара', 'dilnara@pacto.kz', 'mop', 800, 3200, 800),
--   ('UUID_MOP3', 'Ерназар', 'ernazar@pacto.kz', 'mop', 2100, 7600, 2100);

-- Seed наград (10 шт из разных категорий)
insert into public.rewards (title, category, price_coins, description) values
  ('Шоколад плитка', 'Еда и напитки', 450, 'Плитка шоколада на выбор'),
  ('Кофе Старбакс', 'Еда и напитки', 750, 'Кофе на выбор в Старбаксе'),
  ('Донер', 'Еда и напитки', 1000, 'Донер на обед'),
  ('Доставка Volt/Glovo/Яндекс на 3000 ₸', 'Доставка еды', 1500, 'Доставка еды на сумму 3000 тг'),
  ('Telegram Premium', 'Подписки и сервисы', 900, 'Подписка на 1 месяц'),
  ('Такси на 3000 ₸', 'Транспорт', 1500, 'Поездка на такси'),
  ('Барбер', 'Красота', 4000, 'Стрижка у барбера'),
  ('Именная кружка', 'Комфорт и гаджеты', 1750, 'Кружка с именем'),
  ('Книга любая', 'Мерч и аксессуары', 1500, 'Любая книга на выбор'),
  ('Уйти раньше на 1 час', 'Привилегии', 100, 'Разовая привилегия');

-- Seed транзакций и заявок делаем ПОСЛЕ создания auth-юзеров (см. инструкцию ниже).
