-- ==========================================================
-- Система званий (levels)
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

alter table public.users add column last_level_id integer not null default 1;
