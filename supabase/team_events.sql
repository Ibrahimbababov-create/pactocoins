-- ==========================================================
-- Лента событий команды (team_events)
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

-- Лёгкий фид "кто что купил / на что накопил / какой ранг взял".
-- Пишется только с сервера (service_role обходит RLS), читают все
-- залогиненные. title и user_name денормализованы на момент записи,
-- чтобы лента была одним запросом без джойнов — важно, потому что RLS
-- на users не даёт МОПу читать чужие строки, а значит join по users
-- из ленты вырезал бы все чужие события.
create table public.team_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text not null,
  kind text not null check (kind in ('purchase', 'goal_achieved', 'level_up')),
  title text not null,
  icon text,
  created_at timestamptz not null default now()
);

create index idx_team_events_created on public.team_events (created_at desc);

alter table public.team_events enable row level security;

create policy "team_events_select" on public.team_events
  for select using (auth.uid() is not null);

-- ----------------------------------------------------------
-- Бэкфилл, чтобы лента не была пустой на старте
-- ----------------------------------------------------------

-- Покупки за последние 30 дней (кроме отклонённых), без гостя.
insert into public.team_events (user_id, user_name, kind, title, icon, created_at)
select pr.user_id, u.name, 'purchase', r.title, '🛍', pr.created_at
from public.purchase_requests pr
join public.rewards r on r.id = pr.reward_id
join public.users u on u.id = pr.user_id
where pr.created_at > now() - interval '30 days'
  and pr.status <> 'rejected'
  and coalesce(u.is_guest, false) = false;

-- Достигнутые цели (время — updated_at), без гостя.
insert into public.team_events (user_id, user_name, kind, title, icon, created_at)
select g.user_id, u.name, 'goal_achieved', coalesce(r.title, 'цель'), '🎯', g.updated_at
from public.user_goals g
left join public.rewards r on r.id = g.reward_id
join public.users u on u.id = g.user_id
where g.status = 'achieved'
  and g.updated_at > now() - interval '30 days'
  and coalesce(u.is_guest, false) = false;
