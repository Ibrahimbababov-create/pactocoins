-- Этап 3 модуля обучения новичков: материалы по дням (дерево ссылок).
-- Применено миграцией onboarding_phase3_materials 2026-09-07.
--
-- onboarding_items — один item = ссылка (Google Doc / видео / Telegram-группа /
-- презентация) или короткий текстовый блок, сгруппированный по дню и разделу.
-- Два scope:
--   общие  (is_shared=true,  rop_id=null)      — правит админ, /admin/onboarding
--   от РОПа (is_shared=false, rop_id=<rop_id>) — каждый РОП, /mop/onboarding-materials
-- Стажёр (app/mop/page.js) видит общие + материалы своего РОПа.

create table if not exists public.onboarding_items (
  id uuid primary key default uuid_generate_v4(),
  day smallint not null check (day between 1 and 3),
  section text not null default '',
  title text not null,
  url text,
  body text,
  type text not null default 'link'
    check (type in ('link','video','doc','telegram','presentation','text')),
  is_shared boolean not null default true,
  rop_id uuid references public.users(id) on delete cascade,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  constraint onboarding_items_scope_ck check (
    (is_shared and rop_id is null) or (not is_shared and rop_id is not null)
  )
);

create index if not exists onboarding_items_day_sort_idx
  on public.onboarding_items (day, sort);
create index if not exists onboarding_items_rop_idx
  on public.onboarding_items (rop_id);

alter table public.onboarding_items enable row level security;

-- читать может любой залогиненный; запись — только service_role (server actions)
drop policy if exists "onboarding_items_select" on public.onboarding_items;
create policy "onboarding_items_select" on public.onboarding_items
  for select to authenticated using (true);

-- Self-check стажёра «я прошёл день N» (РОП/админ видят и могут поправить
-- на /mop/team и /admin/employees).
alter table public.users
  add column if not exists onboarding_day1_done boolean not null default false,
  add column if not exists onboarding_day2_done boolean not null default false,
  add column if not exists onboarding_day3_done boolean not null default false;
