-- Журнал изменений оплат: кто, когда и что сделал с оплатой.
-- Идемпотентно, только добавление. Читает и пишет только сервер
-- (service_role через lib/supabase-admin.js), сотрудникам и гостям доступа нет.

create table if not exists public.revenue_audit (
  id bigint generated always as identity primary key,
  request_id uuid,
  user_id uuid,
  actor_id uuid,
  actor_name text,
  source text,
  action text check (action in ('create','approve','reject','edit','delete','cancel','other')),
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists revenue_audit_request_idx on public.revenue_audit (request_id);
create index if not exists revenue_audit_created_idx on public.revenue_audit (created_at desc);
create index if not exists revenue_audit_user_idx on public.revenue_audit (user_id);

alter table public.revenue_audit enable row level security;

-- Политик для authenticated/anon нет намеренно.
revoke all on public.revenue_audit from anon, authenticated;
grant all on public.revenue_audit to service_role;
