-- Приветствия новичкам в рабочей группе: бот запоминает id сообщения,
-- чтобы через сутки удалить его (lib/groupWelcome.js, крон /api/cron/daily).
create table if not exists public.group_welcome_messages (
  chat_id bigint not null,
  message_id bigint not null,
  user_id bigint,
  created_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);
alter table public.group_welcome_messages enable row level security;
create index if not exists group_welcome_messages_created_idx on public.group_welcome_messages (created_at);
