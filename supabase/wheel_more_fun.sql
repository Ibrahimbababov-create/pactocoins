-- Колесо фортуны интереснее (октябрь 2026): сектор «Пусто» и редкие минусы.
--
-- Порядок: сначала выкатить код (PR), потом применить этот файл.
-- Код сам не даёт уйти в минус по балансу: теряешь не больше, чем есть.
--
-- 1. Разрешаем отрицательный приз, но только у коинов (минус -1000 и меньше
--    не нужен: потолок защищает от опечатки в админке).
alter table public.wheel_segments drop constraint if exists wheel_segments_prize_amount_check;
alter table public.wheel_segments add constraint wheel_segments_prize_amount_check
  check ((prize_amount >= 0) or (prize_type = 'coins' and prize_amount >= -1000));

-- 2. Старые секторы выключаем (история круток ссылается на них), новые вставляем.
--    Ожидание выплаты за крутку: было 54,6 коина, стало 44,8 (вес / 200).
update public.wheel_segments set is_active = false where is_active = true;

insert into public.wheel_segments (label, weight, prize_type, prize_amount, color, sort_order, is_active) values
  ('+20 коинов',     22, 'coins',  20,   '#5C8A0D', 1,  true),
  ('Пусто',          12, 'nothing', 0,   '#171C22', 2,  true),
  ('10 фишек',       37, 'chips',  10,   '#20242A', 3,  true),
  ('+80 коинов',     27, 'coins',  80,   '#5C8A0D', 4,  true),
  ('-10 коинов',      8, 'coins', -10,   '#C4593B', 5,  true),
  ('+40 коинов',     28, 'coins',  40,   '#2B313A', 6,  true),
  ('20 фишек',       28, 'chips',  20,   '#20242A', 7,  true),
  ('+150 коинов',    16, 'coins', 150,   '#7FCF12', 8,  true),
  ('Пусто',          12, 'nothing', 0,   '#171C22', 9,  true),
  ('+400 коинов',     5, 'coins', 400,   '#7FCF12', 10, true),
  ('-20 коинов',      4, 'coins', -20,   '#C4593B', 11, true),
  ('Джекпот +1000',   1, 'coins', 1000,  '#A3FF12', 12, true);
