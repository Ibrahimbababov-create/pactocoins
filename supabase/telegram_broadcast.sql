-- ==========================================================
-- Рассылка в Telegram напрямую (personal broadcast)
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

alter table public.users add column telegram_id bigint;

-- Заполняем telegram_id для уже существующих пользователей,
-- у которых email имеет вид "tg{telegram_id}@pactocoins.local"
-- (так регистрирует их app/api/auth/telegram/route.js).
update public.users
set telegram_id = substring(email from '^tg(\d+)@pactocoins\.local$')::bigint
where email ~ '^tg\d+@pactocoins\.local$'
  and telegram_id is null;
