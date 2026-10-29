-- Проект у каждой оплаты запоминается в момент подачи (revenue_requests.project_id).
-- Раньше проект оплаты считался по текущему проекту сотрудника, и при его
-- переводе вся прошлая выручка «переезжала» вместе с ним.
-- Применено владельцем 29.10.2026. Безопасно запускать повторно.

alter table public.revenue_requests
  add column if not exists project_id uuid references public.projects (id) on delete set null;

-- Старые оплаты: проект сотрудника на сегодня (точнее восстановить нельзя).
update public.revenue_requests r
   set project_id = u.project_id
  from public.users u
 where u.id = r.user_id and r.project_id is null;

-- Новые оплаты: проект подставляется сам из профиля, код вставки менять не нужно.
create or replace function public.set_revenue_project()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.project_id is null then
    select project_id into new.project_id from public.users where id = new.user_id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_set_revenue_project on public.revenue_requests;
create trigger trg_set_revenue_project before insert on public.revenue_requests
  for each row execute function public.set_revenue_project();

create index if not exists revenue_requests_project_idx on public.revenue_requests (project_id);

-- Оплата Никиты 300 000 ₸ от 13.10.2026 была на проекте МИР.
update public.revenue_requests
   set project_id = '720b883e-cd08-4980-bfb9-74d705f55d7c'
 where id = '444c7f9a-2b82-41a9-b931-9de8826a26d8';
