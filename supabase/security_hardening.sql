-- Закрываем дыры, через которые сотрудник (или кто угодно с публичным
-- ключом сайта) мог двигать коины и рейтинг в обход приложения.
-- Приложение после этого работает как раньше: все места, которых это
-- касается, ходят в базу через серверный service_role-ключ.
-- Применять целиком, один раз. Повторный запуск безопасен.

begin;

-- 1. spend_coins: security definer + принимает любой uid + был открыт
--    anon/authenticated. Можно было списать коины у любого человека или
--    за 1 коин выдать себе сколько угодно круток колеса (spins_delta).
--    Вызывает её только сервер (lib/spendCoins.js, service_role).
revoke all on function public.spend_coins(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.spend_coins(uuid, integer, integer) to service_role;

-- 2. rating_revenue: выручка всех сотрудников читалась без входа (anon).
--    Приложение вызывает её только после входа или с сервера.
revoke all on function public.rating_revenue(timestamptz, timestamptz) from public, anon;
grant execute on function public.rating_revenue(timestamptz, timestamptz) to authenticated, service_role;

-- 3. Заявки на выручку: сотрудник мог вставить заявку сразу со статусом
--    approved — она шла в рейтинг, топ в группе и призы без одобрения.
--    Приложение всегда шлёт status = 'pending'.
drop policy if exists revenue_insert on public.revenue_requests;
create policy revenue_insert on public.revenue_requests for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and credited_coins is null
  );

-- 4. Заявки на бонусы — то же самое.
drop policy if exists bonus_insert on public.bonus_requests;
create policy bonus_insert on public.bonus_requests for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and credited_coins is null
  );

-- 5. Покупки: сотрудник мог создать заявку на покупку напрямую, не
--    заплатив коинами (или сразу «одобренную»), — админ увидел бы её как
--    обычную покупку и выдал награду. Приложение создаёт покупки только
--    сервером после spend_coins, так что правило для сотрудников не нужно.
drop policy if exists purchase_insert on public.purchase_requests;

-- 6. Атомарное начисление. Сейчас начисления делаются «прочитал баланс →
--    прибавил → записал»; если в ту же секунду прошла покупка, одно из
--    изменений теряется. После применения код переводится на add_coins.
create or replace function public.add_coins(uid uuid, amount integer)
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare new_balance integer;
begin
  if amount is null or amount = 0 then
    select balance into new_balance from public.users where id = uid;
    return new_balance;
  end if;
  update public.users set balance = balance + amount
   where id = uid
  returning balance into new_balance;
  return new_balance;
end; $$;
revoke all on function public.add_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.add_coins(uuid, integer) to service_role;

commit;
