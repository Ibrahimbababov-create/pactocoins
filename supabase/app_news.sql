-- ==========================================================
-- Новости приложения для сотрудников
-- Выполнить в Supabase SQL Editor. Скрипт можно запускать повторно:
-- он только добавляет, ничего не удаляет и не меняет.
-- ==========================================================

create table if not exists public.app_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  important boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_app_news_published_at
  on public.app_news (published_at desc);

-- Кто какую новость прочитал
create table if not exists public.app_news_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  news_id uuid not null references public.app_news(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (user_id, news_id)
);

alter table public.app_news enable row level security;
alter table public.app_news_reads enable row level security;

-- Новости читают только залогиненные и только опубликованные.
-- Писать, править и удалять новости может только сервер (service_role
-- обходит RLS, поэтому отдельных политик на запись нет).
drop policy if exists "app_news_select_published" on public.app_news;
create policy "app_news_select_published" on public.app_news
  for select to authenticated using (is_published);

-- Отметки о прочтении: каждый видит и ставит только свои.
drop policy if exists "app_news_reads_select_own" on public.app_news_reads;
create policy "app_news_reads_select_own" on public.app_news_reads
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "app_news_reads_insert_own" on public.app_news_reads;
create policy "app_news_reads_insert_own" on public.app_news_reads
  for insert to authenticated with check (auth.uid() = user_id);

-- Анонимам ничего не даём
revoke all on public.app_news from anon;
revoke all on public.app_news_reads from anon;
