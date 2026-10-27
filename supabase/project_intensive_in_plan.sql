-- Входят ли интенсивы и мастер-классы (revenue_requests.product_kind = 'intensive')
-- в план проекта. По умолчанию входят, чтобы ничего не изменилось само.
-- Рейтинг и коины всегда считают всю выручку, этот флаг на них не влияет.
-- Безопасно запускать повторно.
alter table public.projects
  add column if not exists intensive_in_plan boolean not null default true;
