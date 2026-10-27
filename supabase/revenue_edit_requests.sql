-- Исправления оплат: сотрудник предлагает поправить свою оплату (сумма,
-- дата, ФИО клиента, продукт, вид оплаты), применяет только админ.
-- Идемпотентно, только добавление. Существующие таблицы не меняются.
--
-- proposed — только те поля, что меняются: amount_kzt, earned_at (ISO),
--            client_name, product_kind, pay_kind, is_final_part.
-- original — те же поля оплаты на момент подачи. По ним сервер видит,
--            что оплату успели поменять, пока исправление ждало решения.

create table if not exists public.revenue_edit_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.revenue_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  proposed jsonb not null,
  original jsonb,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_comment text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists revenue_edit_requests_status_created_idx
  on public.revenue_edit_requests (status, created_at desc);
create index if not exists revenue_edit_requests_request_idx
  on public.revenue_edit_requests (request_id);
create index if not exists revenue_edit_requests_user_idx
  on public.revenue_edit_requests (user_id);

-- Не больше одного исправления на рассмотрении на одну оплату.
create unique index if not exists revenue_edit_requests_one_pending
  on public.revenue_edit_requests (request_id)
  where status = 'pending';

alter table public.revenue_edit_requests enable row level security;

-- Сотрудник видит только свои исправления.
drop policy if exists revenue_edit_select on public.revenue_edit_requests;
create policy revenue_edit_select on public.revenue_edit_requests for select
  using ((user_id = auth.uid()) or is_admin());

-- Подать можно только на себя, только на свою не отклонённую оплату и
-- только «на рассмотрении», без следов решения админа.
drop policy if exists revenue_edit_insert on public.revenue_edit_requests;
create policy revenue_edit_insert on public.revenue_edit_requests for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_comment is null
    and exists (
      select 1 from public.revenue_requests r
      where r.id = request_id
        and r.user_id = auth.uid()
        and r.status <> 'rejected'
    )
  );

-- Менять и удалять может только сервер (service_role): политик update/delete
-- для authenticated нет намеренно.
revoke all on public.revenue_edit_requests from anon;
revoke update, delete, truncate on public.revenue_edit_requests from authenticated;
grant select, insert on public.revenue_edit_requests to authenticated;
grant all on public.revenue_edit_requests to service_role;
