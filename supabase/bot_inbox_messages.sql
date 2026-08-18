-- ==========================================================
-- Сообщения, которые сотрудники пишут боту в личку в Telegram
-- (не через команды) — раньше терялись, теперь sales-bot
-- сохраняет их сюда, видно только админу.
-- Выполнено напрямую через подключение к БД.
-- ==========================================================

create table public.bot_inbox_messages (
  id uuid primary key default uuid_generate_v4(),
  telegram_id bigint not null,
  telegram_name text,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_bot_inbox_telegram_id on public.bot_inbox_messages(telegram_id);

alter table public.bot_inbox_messages enable row level security;

create policy "bot_inbox_select_admin" on public.bot_inbox_messages
  for select using (public.is_admin());

create policy "bot_inbox_update_admin" on public.bot_inbox_messages
  for update using (public.is_admin());
