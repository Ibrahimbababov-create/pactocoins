-- Сундук за «Приход вовремя» (октябрь 2026): личный подарок на 30 фишек,
-- один на человека в день по Алматы. Кладётся в chest_gifts, открывается
-- существующим claim_chest. Код: lib/attendanceChest.js.
-- dedupe_key = 'attendance:<user_id>:<YYYY-MM-DD по Алматы>'. Уникальность
-- в базе не даёт выдать второй сундук за тот же день (повторный кружок,
-- ручное одобрение, два админа). NULL у обычных подарков не мешает.
set lock_timeout = '5s';
alter table public.chest_gifts add column if not exists dedupe_key text;
alter table public.chest_gifts add constraint chest_gifts_dedupe_key_key unique (dedupe_key);
