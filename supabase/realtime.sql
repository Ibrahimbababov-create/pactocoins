-- Таблицы, изменения которых приложение получает сразу (Supabase Realtime).
-- Права на чтение берутся из RLS этих таблиц, отдельно ничего не открывается.
-- Применено 17.10.2026.

-- Живой баланс на главной (components/LiveBalance.js): пришли коины, цифра
-- меняется сама, без перезагрузки. До этого подписка в коде была, а таблица
-- в публикацию не входила, поэтому событие не приходило.
alter publication supabase_realtime add table public.transactions;

-- Экран «Наблюдать за игрой» (components/TournamentLive.js), см. tournaments.sql.
-- alter publication supabase_realtime add table public.tournament_matches, public.tournament_entries, public.tournaments;
