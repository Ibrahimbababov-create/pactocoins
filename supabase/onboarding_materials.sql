-- Онбординг v2 — блочная программа обучения стажёра.
-- Применено миграцией onboarding_v2_blocks 2026-09-08 (заменила v1 onboarding_items).
--
-- День → упорядоченные блоки. У блока владелец (admin | rop) и тип
-- (article | links | test). Общий контент админа лежит в onboarding_blocks;
-- версия РОПа под свой проект — в onboarding_rop_blocks; ссылки — onboarding_links
-- (rop_id null = общая, иначе ссылка конкретного РОПа). Прогресс стажёра —
-- onboarding_progress (отметка «изучил» по блоку). Гейтинг: следующий блок и
-- следующий день закрыты, пока не пройдены required-блоки текущего.
-- Тесты (onboarding_tests/questions/attempts) — схема есть, вопросы и прохождение
-- добавляются следующим обновлением.
--
-- Статьи хранятся как mini-markdown (source='text', body_md) или ссылка на
-- telegra.ph (source='telegraph', cached_content — снимок содержимого через
-- api.telegra.ph, чтобы обучение не зависело от доступности telegra.ph).
-- Рендер: lib/mdlite.js и lib/telegraph.js.

create table public.onboarding_blocks (
  id uuid primary key default uuid_generate_v4(),
  day smallint not null check (day between 1 and 3),
  sort int not null default 0,
  key text not null unique,
  title text not null,
  subtitle text,
  owner text not null default 'admin' check (owner in ('admin', 'rop')),
  kind text not null default 'article' check (kind in ('article', 'links', 'test')),
  required boolean not null default true,
  source text check (source in ('telegraph', 'text')),
  telegraph_url text,
  body_md text,
  cached_content jsonb,
  cached_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.onboarding_rop_blocks (
  id uuid primary key default uuid_generate_v4(),
  block_id uuid not null references public.onboarding_blocks(id) on delete cascade,
  rop_id uuid not null references public.users(id) on delete cascade,
  source text not null check (source in ('telegraph', 'text')),
  telegraph_url text,
  body_md text,
  cached_content jsonb,
  cached_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (block_id, rop_id)
);

create table public.onboarding_links (
  id uuid primary key default uuid_generate_v4(),
  block_id uuid not null references public.onboarding_blocks(id) on delete cascade,
  rop_id uuid references public.users(id) on delete cascade,
  title text not null,
  url text not null,
  note text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index onboarding_links_block_idx on public.onboarding_links (block_id);

create table public.onboarding_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  block_id uuid not null references public.onboarding_blocks(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (user_id, block_id)
);

create table public.onboarding_tests (
  id uuid primary key default uuid_generate_v4(),
  day smallint not null unique check (day between 1 and 3),
  title text not null,
  pass_pct int not null default 80
);
create table public.onboarding_questions (
  id uuid primary key default uuid_generate_v4(),
  test_id uuid not null references public.onboarding_tests(id) on delete cascade,
  sort int not null default 0,
  question text not null,
  options jsonb not null,
  correct int not null
);
create table public.onboarding_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  test_id uuid not null references public.onboarding_tests(id) on delete cascade,
  score_pct int not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

-- RLS: чтение для authenticated, запись — только service_role (server actions).
alter table public.onboarding_blocks     enable row level security;
alter table public.onboarding_rop_blocks enable row level security;
alter table public.onboarding_links      enable row level security;
alter table public.onboarding_progress   enable row level security;
alter table public.onboarding_tests      enable row level security;
alter table public.onboarding_questions  enable row level security;
alter table public.onboarding_attempts   enable row level security;

create policy "ob_blocks_read"   on public.onboarding_blocks     for select to authenticated using (true);
create policy "ob_rop_read"      on public.onboarding_rop_blocks for select to authenticated using (true);
create policy "ob_links_read"    on public.onboarding_links      for select to authenticated using (true);
create policy "ob_progress_read" on public.onboarding_progress   for select to authenticated using (true);
create policy "ob_tests_read"    on public.onboarding_tests      for select to authenticated using (true);
create policy "ob_questions_read" on public.onboarding_questions for select to authenticated using (true);
create policy "ob_attempts_read" on public.onboarding_attempts   for select to authenticated using (true);

-- Скелет блоков и стартовый контент засеяны миграцией + отдельным апдейтом
-- (глоссарий, взаимодействие, регламент, график, мотивация, уроки продаж,
-- регламент CRM). Правится в /admin/onboarding и /mop/onboarding-materials.

-- --- Файлы (миграция onboarding_files_bucket 2026-09-08) ---
-- Storage bucket 'onboarding-files' (public, 20 МБ, image/*, pdf).
-- Клиент грузит напрямую (lib/uploadOnboardingFile.js, минуя лимит тела
-- Vercel), ссылка кладётся в onboarding_links. RLS storage.objects:
-- select — public; insert/delete — authenticated с ролью admin|rop.
-- При удалении ссылки-файла server action чистит и объект в bucket.
