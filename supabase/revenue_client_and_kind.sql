-- ФИО клиента и вид оплаты у заявки на выручку (чтобы сверять с таблицей зарплат).
-- Только добавление колонок: старые строки остаются с null («неизвестно»),
-- обязательность проверяет серверное действие, а не база.
-- RLS не меняется: политика revenue_insert смотрит на user_id/status/reviewed_*/credited_coins,
-- новые колонки её не ослабляют.
-- Применять ДО выкладки кода. Можно запускать повторно.

alter table public.revenue_requests add column if not exists client_name text;
alter table public.revenue_requests add column if not exists product_kind text;
alter table public.revenue_requests add column if not exists pay_kind text;
alter table public.revenue_requests add column if not exists is_final_part boolean;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'revenue_requests_product_kind_check') then
    alter table public.revenue_requests
      add constraint revenue_requests_product_kind_check
      check (product_kind is null or product_kind in ('course', 'intensive'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'revenue_requests_pay_kind_check') then
    alter table public.revenue_requests
      add constraint revenue_requests_pay_kind_check
      check (pay_kind is null or pay_kind in ('full', 'part'));
  end if;
end $$;

-- Подсказки тёзок и проверка дублей ищут заявки одного сотрудника по имени клиента.
create index if not exists idx_revenue_requests_user_client
  on public.revenue_requests (user_id, lower(client_name))
  where client_name is not null;
