-- Заполняем public.users реальными UUID из Authentication > Users

insert into public.users (id, name, email, role, balance, total_earned, month_earned) values
  ('a211b652-fd01-4611-8e9c-a8aa6e299c9c', 'Админ', 'admin@pacto.kz', 'admin', 0, 0, 0),
  ('a6e773ca-39a3-4ed4-9628-eb3e77c1cf5f', 'МОП 1', 'mop1@gmail.com', 'mop', 1200, 5000, 1200),
  ('086ac639-3580-4035-bb23-59559ba98091', 'МОП 2', 'mop2@gmail.com', 'mop', 800, 3200, 800),
  ('bc9684b8-8a05-45d2-8291-0e05b7381dbb', 'МОП 3', 'mop3@gmail.com', 'mop', 2100, 7600, 2100);

-- Тестовые транзакции (5 шт для примера истории операций)
insert into public.transactions (user_id, type, amount_coins, description, created_by) values
  ('a6e773ca-39a3-4ed4-9628-eb3e77c1cf5f', 'earn', 1200, 'Выручка подтверждена: 1 200 000 ₸', 'a211b652-fd01-4611-8e9c-a8aa6e299c9c'),
  ('086ac639-3580-4035-bb23-59559ba98091', 'earn', 800, 'Выручка подтверждена: 800 000 ₸', 'a211b652-fd01-4611-8e9c-a8aa6e299c9c'),
  ('bc9684b8-8a05-45d2-8291-0e05b7381dbb', 'earn', 2100, 'Выручка подтверждена: 2 100 000 ₸', 'a211b652-fd01-4611-8e9c-a8aa6e299c9c'),
  ('a6e773ca-39a3-4ed4-9628-eb3e77c1cf5f', 'manual_add', 100, 'Бонус за активность', 'a211b652-fd01-4611-8e9c-a8aa6e299c9c'),
  ('086ac639-3580-4035-bb23-59559ba98091', 'manual_subtract', -50, 'Корректировка ошибки начисления', 'a211b652-fd01-4611-8e9c-a8aa6e299c9c');
