-- Полная структура базы PactoCoins. Только структура: ни одного
-- сотрудника, ни одного коина, ни одной заявки здесь нет.
--
-- Зачем нужен: поднять свою копию приложения с нуля. Заводишь пустой
-- проект в Supabase, открываешь SQL Editor, выполняешь этот файл целиком —
-- получаешь базу, с которой код из этого репозитория запускается.
--
-- Что делать дальше:
--   1. Прописать у себя NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
--      и SUPABASE_SERVICE_ROLE_KEY — свои собственные, из своего проекта.
--   2. Задать DEV_LOGIN_SECRET (любая фраза от 16 символов) и открыть
--      /api/auth/dev?secret=<фраза>&role=admin — это заведёт тестового
--      админа и пустит внутрь без Telegram.
--   3. Товары магазина, если нужны, берутся из supabase/full_rewards_seed.sql.
--
-- Файл отражает боевую структуру на 8 октября 2026 года.

create extension if not exists "uuid-ossp" with schema extensions;

-- ---------- Перечисления ----------

create type public.fund_status as enum ('active', 'completed', 'closed');
create type public.join_request_status as enum ('pending', 'approved', 'rejected');
create type public.purchase_status as enum ('pending', 'approved', 'done', 'rejected');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.transaction_source as enum ('revenue', 'bonus', 'wheel', 'manual', 'birthday', 'refund');
create type public.transaction_type as enum ('earn', 'spend', 'manual_add', 'manual_subtract');
create type public.user_role as enum ('admin', 'mop', 'observer', 'rop', 'trainee', 'mentor');

-- ---------- Таблицы ----------

create table if not exists public.users (
  id uuid not null,
  name text not null,
  email text not null,
  role user_role not null default 'mop'::user_role,
  balance integer not null default 0,
  total_earned integer not null default 0,
  month_key text not null default to_char(now(), 'YYYY-MM'::text),
  created_at timestamptz not null default now(),
  birthday date,
  last_birthday_bonus_year integer,
  last_level_id integer not null default 1,
  telegram_id bigint,
  reminder_enabled boolean not null default false,
  reminder_time time without time zone,
  reminder_last_sent_date date,
  is_active boolean not null default true,
  coin_rate_multiplier numeric(4,2) not null default 1.0,
  is_guest boolean not null default false,
  celebrated_level_id integer not null default 1,
  notify_requests boolean not null default true,
  notify_shop boolean not null default true,
  notify_goal boolean not null default true,
  notify_rating boolean not null default true,
  wheel_spins integer not null default 0,
  rop_id uuid,
  level integer not null default 1,
  theme text not null default 'brass'::text,
  project_id uuid,
  mentor_id uuid,
  home_screen_tip_sent_at timestamptz
);

create table if not exists public.projects (
  id uuid not null default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.project_rops (
  project_id uuid not null,
  rop_id uuid not null
);

create table if not exists public.transactions (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  type transaction_type not null,
  amount_coins integer not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid,
  rating_exempt boolean not null default false,
  source transaction_source not null
);

create table if not exists public.revenue_requests (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  amount_kzt integer not null,
  calculated_coins integer not null,
  comment text,
  status request_status not null default 'pending'::request_status,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  receipt_url text,
  receipt_confirmed boolean not null default false,
  admin_chat_id bigint,
  admin_message_id bigint,
  admin_reply_comment text,
  credited_coins integer,
  earned_at timestamptz default now()
);

create table if not exists public.bonus_requests (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  category text not null,
  amount_coins integer not null,
  comment text,
  status request_status not null default 'pending'::request_status,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_chat_id bigint,
  admin_message_id bigint,
  admin_reply_comment text,
  credited_coins integer
);

create table if not exists public.rewards (
  id uuid not null default uuid_generate_v4(),
  title text not null,
  category text not null,
  price_coins integer,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  sort_order integer not null default 0,
  highlight_color text,
  is_variable boolean not null default false,
  rate_coins integer,
  rate_kzt integer,
  sale_price_coins integer,
  sale_ends_at timestamptz,
  image_url text
);

create table if not exists public.reward_variants (
  id uuid not null default gen_random_uuid(),
  reward_id uuid not null,
  label text not null,
  price_coins integer not null,
  sort_order integer not null default 0,
  image_url text
);

create table if not exists public.reward_categories (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_suggestions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  price_coins integer not null,
  description text,
  image_url text,
  status text not null default 'pending'::text,
  admin_comment text,
  reward_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

create table if not exists public.purchase_requests (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  reward_id uuid not null,
  price_coins integer not null,
  status purchase_status not null default 'pending'::purchase_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kzt_amount integer,
  actual_kzt_amount integer,
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_chat_id bigint,
  admin_message_id bigint,
  admin_reply_comment text,
  variant_label text
);

create table if not exists public.user_goals (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  target_amount integer not null,
  deadline date,
  status text not null default 'active'::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reward_id uuid,
  variant_label text
);

create table if not exists public.budget_topups (
  id uuid not null default uuid_generate_v4(),
  amount_kzt integer not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  given_at date not null default CURRENT_DATE
);

create table if not exists public.funds (
  id uuid not null default uuid_generate_v4(),
  title text not null,
  description text,
  goal_coins integer not null,
  status fund_status not null default 'active'::fund_status,
  created_by uuid,
  created_at timestamptz not null default now(),
  image_url text
);

create table if not exists public.fund_contributions (
  id uuid not null default uuid_generate_v4(),
  fund_id uuid not null,
  user_id uuid not null,
  amount_coins integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid not null default uuid_generate_v4(),
  sender_id uuid not null,
  recipient_id uuid not null,
  content text not null,
  is_anonymous boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.anonymous_messages (
  id uuid not null default uuid_generate_v4(),
  sender_id uuid,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bot_inbox_messages (
  id uuid not null default uuid_generate_v4(),
  telegram_id bigint not null,
  telegram_name text,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.chat_members (
  chat_id bigint not null,
  user_id bigint not null,
  name text,
  username text,
  last_seen timestamptz not null default now()
);

create table if not exists public.join_requests (
  id uuid not null default uuid_generate_v4(),
  telegram_id bigint not null,
  telegram_username text,
  name text not null,
  status join_request_status not null default 'pending'::join_request_status,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  birthday date,
  rop_id uuid,
  admin_chat_id bigint,
  admin_message_id bigint,
  admin_reply_comment text,
  mentor_id uuid
);

create table if not exists public.team_events (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  user_name text not null,
  kind text not null,
  title text not null,
  icon text,
  created_at timestamptz not null default now()
);

-- Обучение новичков
create table if not exists public.onboarding_blocks (
  id uuid not null default uuid_generate_v4(),
  day smallint not null,
  sort integer not null default 0,
  key text not null,
  title text not null,
  subtitle text,
  owner text not null default 'admin'::text,
  kind text not null default 'article'::text,
  required boolean not null default true,
  source text,
  telegraph_url text,
  body_md text,
  cached_content jsonb,
  cached_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_links (
  id uuid not null default uuid_generate_v4(),
  block_id uuid not null,
  rop_id uuid,
  title text not null,
  url text not null,
  note text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_rop_blocks (
  id uuid not null default uuid_generate_v4(),
  block_id uuid not null,
  rop_id uuid not null,
  source text not null,
  telegraph_url text,
  body_md text,
  cached_content jsonb,
  cached_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_progress (
  user_id uuid not null,
  block_id uuid not null,
  done_at timestamptz not null default now()
);

create table if not exists public.onboarding_tests (
  id uuid not null default uuid_generate_v4(),
  day smallint not null,
  title text not null,
  pass_pct integer not null default 80
);

create table if not exists public.onboarding_questions (
  id uuid not null default uuid_generate_v4(),
  test_id uuid not null,
  sort integer not null default 0,
  question text not null,
  options jsonb not null,
  correct integer not null
);

create table if not exists public.onboarding_attempts (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null,
  test_id uuid not null,
  score_pct integer not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_practice_tasks (
  id uuid not null default uuid_generate_v4(),
  sort integer not null default 0,
  title text not null,
  hint text,
  target integer,
  owner text not null default 'admin'::text,
  rop_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_practice_progress (
  user_id uuid not null,
  task_id uuid not null,
  count integer not null default 0,
  done boolean not null default false,
  verified_by uuid,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Колесо фортуны
create table if not exists public.wheel_config (
  id boolean not null default true,
  spin_price_coins integer not null default 500,
  buy_enabled boolean not null default true,
  is_open boolean not null default true,
  opens_at timestamptz
);

create table if not exists public.wheel_segments (
  id uuid not null default gen_random_uuid(),
  label text not null,
  weight integer not null default 1,
  prize_type text not null default 'nothing'::text,
  prize_amount integer not null default 0,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wheel_spins (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  segment_id uuid,
  segment_label text,
  prize_type text,
  prize_amount integer default 0,
  cost_coins integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Ключи и связи ----------

alter table public.users add constraint users_pkey primary key (id);
alter table public.users add constraint users_email_key unique (email);
alter table public.users add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.users add constraint users_rop_id_fkey foreign key (rop_id) references users(id) on delete set null;
alter table public.users add constraint users_mentor_id_fkey foreign key (mentor_id) references users(id) on delete set null;
alter table public.users add constraint users_project_id_fkey foreign key (project_id) references projects(id) on delete set null;
alter table public.users add constraint users_balance_check check ((balance >= 0));
alter table public.users add constraint users_coin_rate_multiplier_check check ((coin_rate_multiplier > (0)::numeric));
alter table public.users add constraint users_theme_check check ((theme = any (array['acid'::text, 'brass'::text, 'indigo'::text, 'coral'::text])));

alter table public.projects add constraint projects_pkey primary key (id);
alter table public.project_rops add constraint project_rops_pkey primary key (project_id, rop_id);
alter table public.project_rops add constraint project_rops_project_id_fkey foreign key (project_id) references projects(id) on delete cascade;
alter table public.project_rops add constraint project_rops_rop_id_fkey foreign key (rop_id) references users(id) on delete cascade;

alter table public.transactions add constraint transactions_pkey primary key (id);
alter table public.transactions add constraint transactions_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.transactions add constraint transactions_created_by_fkey foreign key (created_by) references users(id);

alter table public.revenue_requests add constraint revenue_requests_pkey primary key (id);
alter table public.revenue_requests add constraint revenue_requests_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.revenue_requests add constraint revenue_requests_reviewed_by_fkey foreign key (reviewed_by) references users(id);
alter table public.revenue_requests add constraint revenue_requests_amount_kzt_check check ((amount_kzt > 0));

alter table public.bonus_requests add constraint bonus_requests_pkey primary key (id);
alter table public.bonus_requests add constraint bonus_requests_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.bonus_requests add constraint bonus_requests_reviewed_by_fkey foreign key (reviewed_by) references users(id);

alter table public.rewards add constraint rewards_pkey primary key (id);
alter table public.rewards add constraint rewards_price_check check ((((is_variable = false) and (price_coins > 0)) or ((is_variable = true) and (rate_coins > 0) and (rate_kzt > 0))));
alter table public.rewards add constraint rewards_sale_price_check check (((sale_price_coins is null) or (sale_price_coins > 0)));

alter table public.reward_variants add constraint reward_variants_pkey primary key (id);
alter table public.reward_variants add constraint reward_variants_reward_id_fkey foreign key (reward_id) references rewards(id) on delete cascade;
alter table public.reward_variants add constraint reward_variants_price_coins_check check ((price_coins > 0));

alter table public.reward_categories add constraint reward_categories_pkey primary key (id);
alter table public.reward_categories add constraint reward_categories_name_key unique (name);

alter table public.reward_suggestions add constraint reward_suggestions_pkey primary key (id);
alter table public.reward_suggestions add constraint reward_suggestions_user_id_fkey foreign key (user_id) references users(id);
alter table public.reward_suggestions add constraint reward_suggestions_reward_id_fkey foreign key (reward_id) references rewards(id);
alter table public.reward_suggestions add constraint reward_suggestions_reviewed_by_fkey foreign key (reviewed_by) references users(id);
alter table public.reward_suggestions add constraint reward_suggestions_price_coins_check check ((price_coins > 0));
alter table public.reward_suggestions add constraint reward_suggestions_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.purchase_requests add constraint purchase_requests_pkey primary key (id);
alter table public.purchase_requests add constraint purchase_requests_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.purchase_requests add constraint purchase_requests_reward_id_fkey foreign key (reward_id) references rewards(id);
alter table public.purchase_requests add constraint purchase_requests_reviewed_by_fkey foreign key (reviewed_by) references users(id) on delete set null;

alter table public.user_goals add constraint user_goals_pkey primary key (id);
alter table public.user_goals add constraint user_goals_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.user_goals add constraint user_goals_reward_id_fkey foreign key (reward_id) references rewards(id) on delete set null;
alter table public.user_goals add constraint user_goals_status_check check ((status = any (array['active'::text, 'achieved'::text])));
alter table public.user_goals add constraint user_goals_target_amount_check check ((target_amount > 0));

alter table public.budget_topups add constraint budget_topups_pkey primary key (id);
alter table public.budget_topups add constraint budget_topups_created_by_fkey foreign key (created_by) references users(id);
alter table public.budget_topups add constraint budget_topups_amount_kzt_check check ((amount_kzt > 0));

alter table public.funds add constraint funds_pkey primary key (id);
alter table public.funds add constraint funds_created_by_fkey foreign key (created_by) references users(id);
alter table public.funds add constraint funds_goal_coins_check check ((goal_coins > 0));

alter table public.fund_contributions add constraint fund_contributions_pkey primary key (id);
alter table public.fund_contributions add constraint fund_contributions_fund_id_fkey foreign key (fund_id) references funds(id) on delete cascade;
alter table public.fund_contributions add constraint fund_contributions_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.fund_contributions add constraint fund_contributions_amount_coins_check check ((amount_coins > 0));

alter table public.messages add constraint messages_pkey primary key (id);
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references users(id) on delete cascade;
alter table public.messages add constraint messages_recipient_id_fkey foreign key (recipient_id) references users(id) on delete cascade;

alter table public.anonymous_messages add constraint anonymous_messages_pkey primary key (id);
alter table public.anonymous_messages add constraint anonymous_messages_sender_id_fkey foreign key (sender_id) references users(id) on delete set null;

alter table public.bot_inbox_messages add constraint bot_inbox_messages_pkey primary key (id);
alter table public.chat_members add constraint chat_members_pkey primary key (chat_id, user_id);

alter table public.join_requests add constraint join_requests_pkey primary key (id);
alter table public.join_requests add constraint join_requests_rop_id_fkey foreign key (rop_id) references users(id) on delete set null;
alter table public.join_requests add constraint join_requests_mentor_id_fkey foreign key (mentor_id) references users(id) on delete set null;
alter table public.join_requests add constraint join_requests_reviewed_by_fkey foreign key (reviewed_by) references users(id);

alter table public.team_events add constraint team_events_pkey primary key (id);
alter table public.team_events add constraint team_events_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.team_events add constraint team_events_kind_check check ((kind = any (array['purchase'::text, 'goal_achieved'::text, 'level_up'::text, 'wheel'::text])));

alter table public.onboarding_blocks add constraint onboarding_blocks_pkey primary key (id);
alter table public.onboarding_blocks add constraint onboarding_blocks_key_key unique (key);
alter table public.onboarding_blocks add constraint onboarding_blocks_day_check check (((day >= 1) and (day <= 3)));
alter table public.onboarding_blocks add constraint onboarding_blocks_kind_check check ((kind = any (array['article'::text, 'links'::text, 'test'::text])));
alter table public.onboarding_blocks add constraint onboarding_blocks_owner_check check ((owner = any (array['admin'::text, 'rop'::text])));
alter table public.onboarding_blocks add constraint onboarding_blocks_source_check check ((source = any (array['telegraph'::text, 'text'::text])));

alter table public.onboarding_links add constraint onboarding_links_pkey primary key (id);
alter table public.onboarding_links add constraint onboarding_links_block_id_fkey foreign key (block_id) references onboarding_blocks(id) on delete cascade;
alter table public.onboarding_links add constraint onboarding_links_rop_id_fkey foreign key (rop_id) references users(id) on delete cascade;

alter table public.onboarding_rop_blocks add constraint onboarding_rop_blocks_pkey primary key (id);
alter table public.onboarding_rop_blocks add constraint onboarding_rop_blocks_block_id_rop_id_key unique (block_id, rop_id);
alter table public.onboarding_rop_blocks add constraint onboarding_rop_blocks_block_id_fkey foreign key (block_id) references onboarding_blocks(id) on delete cascade;
alter table public.onboarding_rop_blocks add constraint onboarding_rop_blocks_rop_id_fkey foreign key (rop_id) references users(id) on delete cascade;
alter table public.onboarding_rop_blocks add constraint onboarding_rop_blocks_source_check check ((source = any (array['telegraph'::text, 'text'::text])));

alter table public.onboarding_progress add constraint onboarding_progress_pkey primary key (user_id, block_id);
alter table public.onboarding_progress add constraint onboarding_progress_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.onboarding_progress add constraint onboarding_progress_block_id_fkey foreign key (block_id) references onboarding_blocks(id) on delete cascade;

alter table public.onboarding_tests add constraint onboarding_tests_pkey primary key (id);
alter table public.onboarding_tests add constraint onboarding_tests_day_key unique (day);
alter table public.onboarding_tests add constraint onboarding_tests_day_check check (((day >= 1) and (day <= 3)));

alter table public.onboarding_questions add constraint onboarding_questions_pkey primary key (id);
alter table public.onboarding_questions add constraint onboarding_questions_test_id_fkey foreign key (test_id) references onboarding_tests(id) on delete cascade;

alter table public.onboarding_attempts add constraint onboarding_attempts_pkey primary key (id);
alter table public.onboarding_attempts add constraint onboarding_attempts_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.onboarding_attempts add constraint onboarding_attempts_test_id_fkey foreign key (test_id) references onboarding_tests(id) on delete cascade;

alter table public.onboarding_practice_tasks add constraint onboarding_practice_tasks_pkey primary key (id);
alter table public.onboarding_practice_tasks add constraint onboarding_practice_tasks_rop_id_fkey foreign key (rop_id) references users(id) on delete cascade;
alter table public.onboarding_practice_tasks add constraint onboarding_practice_tasks_owner_check check ((owner = any (array['admin'::text, 'rop'::text])));
alter table public.onboarding_practice_tasks add constraint practice_scope_ck check ((((owner = 'admin'::text) and (rop_id is null)) or ((owner = 'rop'::text) and (rop_id is not null))));

alter table public.onboarding_practice_progress add constraint onboarding_practice_progress_pkey primary key (user_id, task_id);
alter table public.onboarding_practice_progress add constraint onboarding_practice_progress_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.onboarding_practice_progress add constraint onboarding_practice_progress_task_id_fkey foreign key (task_id) references onboarding_practice_tasks(id) on delete cascade;
alter table public.onboarding_practice_progress add constraint onboarding_practice_progress_verified_by_fkey foreign key (verified_by) references users(id);

alter table public.wheel_config add constraint wheel_config_pkey primary key (id);
alter table public.wheel_config add constraint wheel_config_id_check check (id);

alter table public.wheel_segments add constraint wheel_segments_pkey primary key (id);
alter table public.wheel_segments add constraint wheel_segments_prize_amount_check check ((prize_amount >= 0));
alter table public.wheel_segments add constraint wheel_segments_weight_check check ((weight > 0));
alter table public.wheel_segments add constraint wheel_segments_prize_type_check check ((prize_type = any (array['coins'::text, 'spins'::text, 'nothing'::text, 'custom'::text])));

alter table public.wheel_spins add constraint wheel_spins_pkey primary key (id);
alter table public.wheel_spins add constraint wheel_spins_user_id_fkey foreign key (user_id) references users(id) on delete cascade;
alter table public.wheel_spins add constraint wheel_spins_segment_id_fkey foreign key (segment_id) references wheel_segments(id) on delete set null;

-- ---------- Индексы ----------

create index idx_transactions_user on public.transactions using btree (user_id);
create index idx_transactions_user_created on public.transactions using btree (user_id, created_at);
create index idx_transactions_created_positive on public.transactions using btree (created_at) where (amount_coins > 0);
create index idx_revenue_requests_user on public.revenue_requests using btree (user_id);
create index idx_revenue_requests_status_created on public.revenue_requests using btree (status, created_at);
create index idx_revenue_requests_earned on public.revenue_requests using btree (status, earned_at);
create index idx_bonus_requests_user on public.bonus_requests using btree (user_id);
create index idx_purchase_requests_user on public.purchase_requests using btree (user_id);
create index idx_user_goals_user on public.user_goals using btree (user_id);
create unique index user_goals_one_active_per_user on public.user_goals using btree (user_id) where (status = 'active'::text);
create index idx_messages_recipient on public.messages using btree (recipient_id, created_at desc);
create index idx_messages_sender on public.messages using btree (sender_id, created_at desc);
create index idx_fund_contributions_fund on public.fund_contributions using btree (fund_id);
create index idx_fund_contributions_user on public.fund_contributions using btree (user_id);
create index idx_bot_inbox_telegram_id on public.bot_inbox_messages using btree (telegram_id);
create index idx_join_requests_telegram on public.join_requests using btree (telegram_id);
create index idx_team_events_created on public.team_events using btree (created_at desc);
create index idx_users_mentor on public.users using btree (mentor_id);
create index idx_users_project on public.users using btree (project_id);
create index users_rop_id_idx on public.users using btree (rop_id);
create unique index one_guest_account on public.users using btree (is_guest) where (is_guest = true);
create index onboarding_links_block_idx on public.onboarding_links using btree (block_id);
create index onboarding_practice_tasks_sort_idx on public.onboarding_practice_tasks using btree (sort);
create index wheel_spins_user_idx on public.wheel_spins using btree (user_id, created_at desc);

-- ---------- Функции ----------

-- Кто есть кто. Используются в правилах доступа, поэтому security definer:
-- иначе правило на users рекурсивно проверяло бы само себя.
create or replace function public.is_admin()
 returns boolean language sql security definer set search_path to 'public'
as $$ select exists (select 1 from public.users where id = auth.uid() and role = 'admin'); $$;

create or replace function public.is_observer()
 returns boolean language sql security definer set search_path to 'public'
as $$ select exists (select 1 from public.users where id = auth.uid() and role = 'observer'); $$;

create or replace function public.is_observer_or_admin()
 returns boolean language sql security definer set search_path to 'public'
as $$ select exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'observer')); $$;

create or replace function public.is_mentor()
 returns boolean language sql security definer set search_path to 'public'
as $$ select exists (select 1 from public.users where id = auth.uid() and role = 'mentor'); $$;

-- Тип операции по её описанию. Возвраты важно отличать: они не считаются
-- заработком.
create or replace function public.classify_transaction_source(p_type transaction_type, p_description text)
 returns transaction_source language plpgsql immutable set search_path to 'public'
as $$
begin
  if p_description is null then return 'manual'; end if;
  if p_description like 'Выручка подтверждена%' then return 'revenue';
  elsif p_description = 'Возврат за отклонённую покупку' then return 'refund';
  elsif p_description like 'С днём рождения%' then return 'birthday';
  elsif p_description like '%Колесо фортуны%' or p_description like '%Покупка круток%' or p_description like '%Покупка крутки%' then return 'wheel';
  elsif p_description like 'Бонус:%' or p_description like 'Топ-%' or p_description like 'ТОП-%' then return 'bonus';
  else return 'manual';
  end if;
end; $$;

create or replace function public.set_transaction_source()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if new.source is null then
    new.source := classify_transaction_source(new.type, new.description);
  end if;
  return new;
end; $$;

-- «Всего заработано» поддерживается триггером, а не пересчитывается на лету.
create or replace function public.apply_transaction_to_total_earned()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if TG_OP = 'INSERT' then
    if new.amount_coins > 0 and new.source <> 'refund' then
      update users set total_earned = total_earned + new.amount_coins where id = new.user_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if old.amount_coins > 0 and old.source <> 'refund' then
      update users set total_earned = total_earned - old.amount_coins where id = old.user_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.amount_coins > 0 and old.source <> 'refund' then
      update users set total_earned = total_earned - old.amount_coins where id = old.user_id;
    end if;
    if new.amount_coins > 0 and new.source <> 'refund' then
      update users set total_earned = total_earned + new.amount_coins where id = new.user_id;
    end if;
  end if;
  return null;
end; $$;

-- Рейтинг считается по выручке в тенге. security definer обязателен:
-- обычный сотрудник не имеет права читать чужие оплаты, и без этого
-- рейтинг у всех, кроме админа, оказывается пустым.
create or replace function public.rating_revenue(p_start timestamptz, p_end timestamptz)
 returns table(user_id uuid, total bigint, deals integer)
 language sql stable security definer set search_path to 'public'
as $$
  select r.user_id, sum(r.amount_kzt)::bigint, count(*)::int
  from revenue_requests r
  where r.status = 'approved'
    and (p_start is null or coalesce(r.earned_at, r.created_at) >= p_start)
    and (p_end is null or coalesce(r.earned_at, r.created_at) < p_end)
  group by r.user_id
$$;

create or replace function public.earned_in_range(p_user_ids uuid[], p_start timestamptz, p_end timestamptz)
 returns table(user_id uuid, total integer) language sql stable set search_path to 'public'
as $$
  select t.user_id, sum(t.amount_coins)::int
  from transactions t
  where t.user_id = any(p_user_ids) and t.amount_coins > 0 and t.source <> 'refund'
    and (p_start is null or t.created_at >= p_start)
    and (p_end is null or t.created_at < p_end)
  group by t.user_id
$$;

create or replace function public.rating_totals(p_start timestamptz, p_end timestamptz)
 returns table(user_id uuid, source transaction_source, total integer) language sql stable set search_path to 'public'
as $$
  select t.user_id, t.source, sum(t.amount_coins)::int
  from transactions t
  where t.amount_coins > 0 and t.rating_exempt = false
    and (p_start is null or t.created_at >= p_start)
    and (p_end is null or t.created_at < p_end)
  group by t.user_id, t.source
$$;

create or replace function public.purchases_spent_total(p_start timestamptz, p_end timestamptz)
 returns integer language sql stable set search_path to 'public'
as $$
  select coalesce(sum(price_coins), 0)::int from purchase_requests
  where status <> 'rejected' and created_at >= p_start and created_at < p_end
$$;

create or replace function public.fund_totals()
 returns table(fund_id uuid, total integer) language sql stable set search_path to 'public'
as $$ select fc.fund_id, sum(fc.amount_coins)::int from fund_contributions fc group by fc.fund_id $$;

-- Списание коинов одним действием: проверка остатка и само списание
-- происходят в одном запросе, иначе два одновременных нажатия могли
-- увести баланс в минус.
create or replace function public.spend_coins(uid uuid, amount integer, spins_delta integer default 0)
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare new_balance integer;
begin
  if amount is null or amount <= 0 then return null; end if;
  update public.users
     set balance = balance - amount,
         wheel_spins = coalesce(wheel_spins, 0) + coalesce(spins_delta, 0)
   where id = uid and balance >= amount
  returning balance into new_balance;
  return new_balance;
end; $$;

create or replace function public.consume_wheel_spin(uid uuid)
 returns boolean language plpgsql set search_path to 'public'
as $$
declare n integer;
begin
  update public.users set wheel_spins = wheel_spins - 1 where id = uid and wheel_spins > 0;
  get diagnostics n = row_count;
  return n > 0;
end; $$;

-- Тема оформления: сотрудник меняет только свою. Сам update users ему
-- запрещён RLS (только админ), поэтому функция security definer.
create or replace function public.set_my_theme(p_theme text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_theme not in ('acid', 'brass', 'indigo', 'coral') then
    return false;
  end if;
  update public.users set theme = p_theme where id = auth.uid();
  return found;
end; $$;

-- Атомарное начисление (и отмена начисления минусом) — lib/addCoins.js.
create or replace function public.add_coins(uid uuid, amount integer)
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare new_balance integer;
begin
  if amount is null or amount = 0 then
    select balance into new_balance from public.users where id = uid;
    return new_balance;
  end if;
  update public.users set balance = balance + amount where id = uid returning balance into new_balance;
  return new_balance;
end; $$;

-- Права на функции (supabase/security_hardening.sql, октябрь 2026).
-- spend_coins/add_coins двигают чужие балансы — только сервер.
revoke all on function public.spend_coins(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.spend_coins(uuid, integer, integer) to service_role;
revoke all on function public.add_coins(uuid, integer) from public, anon, authenticated;
grant execute on function public.add_coins(uuid, integer) to service_role;
revoke all on function public.rating_revenue(timestamptz, timestamptz) from public, anon;
grant execute on function public.rating_revenue(timestamptz, timestamptz) to authenticated, service_role;
revoke all on function public.set_my_theme(text) from public, anon;
grant execute on function public.set_my_theme(text) to authenticated;

-- ---------- Триггеры ----------

create trigger trg_set_transaction_source before insert on public.transactions
  for each row execute function set_transaction_source();
create trigger trg_transactions_total_earned after insert or delete or update on public.transactions
  for each row execute function apply_transaction_to_total_earned();

-- ---------- Правила доступа ----------

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_rops enable row level security;
alter table public.transactions enable row level security;
alter table public.revenue_requests enable row level security;
alter table public.bonus_requests enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_variants enable row level security;
alter table public.reward_categories enable row level security;
alter table public.reward_suggestions enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.user_goals enable row level security;
alter table public.budget_topups enable row level security;
alter table public.funds enable row level security;
alter table public.fund_contributions enable row level security;
alter table public.messages enable row level security;
alter table public.anonymous_messages enable row level security;
alter table public.bot_inbox_messages enable row level security;
alter table public.chat_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.team_events enable row level security;
alter table public.onboarding_blocks enable row level security;
alter table public.onboarding_links enable row level security;
alter table public.onboarding_rop_blocks enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.onboarding_tests enable row level security;
alter table public.onboarding_questions enable row level security;
alter table public.onboarding_attempts enable row level security;
alter table public.onboarding_practice_tasks enable row level security;
alter table public.onboarding_practice_progress enable row level security;
alter table public.wheel_config enable row level security;
alter table public.wheel_segments enable row level security;
alter table public.wheel_spins enable row level security;

create policy users_select on public.users for select using ((auth.uid() is not null));
create policy users_insert_admin on public.users for insert with check (is_admin());
create policy users_update_admin on public.users for update using (is_admin());

create policy projects_select on public.projects for select using ((auth.uid() is not null));
create policy project_rops_select on public.project_rops for select using ((auth.uid() is not null));

create policy transactions_select on public.transactions for select using ((auth.uid() is not null));
create policy transactions_insert_admin on public.transactions for insert with check (is_admin());

create policy revenue_select on public.revenue_requests for select using (((user_id = auth.uid()) or is_observer_or_admin()));
-- Сотрудник вставляет только pending: иначе мог бы сразу «одобрить» себе выручку.
create policy revenue_insert on public.revenue_requests for insert with check ((user_id = auth.uid()) and (status = 'pending'::request_status) and (reviewed_by is null) and (reviewed_at is null) and (credited_coins is null));
create policy revenue_update_admin on public.revenue_requests for update using (is_admin());

create policy bonus_select on public.bonus_requests for select using (((user_id = auth.uid()) or is_observer_or_admin()));
create policy bonus_insert on public.bonus_requests for insert with check ((user_id = auth.uid()) and (status = 'pending'::request_status) and (reviewed_by is null) and (reviewed_at is null) and (credited_coins is null));
create policy bonus_update_admin on public.bonus_requests for update using (is_admin());

create policy rewards_select on public.rewards for select using (((is_active = true) or is_admin()));
create policy rewards_write_admin on public.rewards for all using (is_admin());
create policy reward_variants_select on public.reward_variants for select using (true);
create policy reward_variants_write_admin on public.reward_variants for all using (is_admin());
create policy reward_categories_select on public.reward_categories for select using ((auth.uid() is not null));
create policy reward_categories_write_admin on public.reward_categories for all using (is_admin());
create policy reward_suggestions_select on public.reward_suggestions for select to authenticated using (true);
create policy reward_suggestions_insert on public.reward_suggestions for insert to authenticated with check ((auth.uid() = user_id));

create policy purchase_select on public.purchase_requests for select using (((user_id = auth.uid()) or is_observer_or_admin()));
-- Покупки создаёт только сервер после spend_coins (service_role обходит RLS).
create policy purchase_insert on public.purchase_requests for insert with check (false);
create policy purchase_update_admin on public.purchase_requests for update using (is_admin());

create policy user_goals_select on public.user_goals for select using (((user_id = auth.uid()) or is_admin() or is_observer()));
create policy user_goals_insert on public.user_goals for insert with check ((user_id = auth.uid()));
create policy user_goals_update on public.user_goals for update using ((user_id = auth.uid()));

create policy budget_topups_admin on public.budget_topups for all using (is_admin());
create policy funds_select on public.funds for select using ((auth.uid() is not null));
create policy funds_write_admin on public.funds for all using (is_admin());
create policy fund_contributions_select on public.fund_contributions for select using ((auth.uid() is not null));

create policy messages_select on public.messages for select using (((sender_id = auth.uid()) or (recipient_id = auth.uid())));
create policy messages_insert on public.messages for insert with check ((sender_id = auth.uid()));
create policy messages_update_read on public.messages for update using ((recipient_id = auth.uid()));

create policy anon_messages_insert on public.anonymous_messages for insert with check ((auth.uid() is not null));
create policy anon_messages_select_admin on public.anonymous_messages for select using (is_observer_or_admin());

create policy bot_inbox_select_admin on public.bot_inbox_messages for select using (is_admin());
create policy bot_inbox_update_admin on public.bot_inbox_messages for update using (is_admin());

-- Заявки на регистрацию принимают админ и наставник.
create policy join_requests_admin on public.join_requests for all using (is_admin());
create policy join_requests_mentor on public.join_requests for all using (is_mentor());

create policy team_events_select on public.team_events for select using ((auth.uid() is not null));

create policy ob_blocks_read on public.onboarding_blocks for select to authenticated using (true);
create policy ob_links_read on public.onboarding_links for select to authenticated using (true);
create policy ob_rop_read on public.onboarding_rop_blocks for select to authenticated using (true);
create policy ob_progress_read on public.onboarding_progress for select to authenticated using (true);
create policy ob_tests_read on public.onboarding_tests for select to authenticated using (true);
create policy ob_questions_read on public.onboarding_questions for select to authenticated using (true);
create policy ob_attempts_read on public.onboarding_attempts for select to authenticated using (true);
create policy opt_read on public.onboarding_practice_tasks for select to authenticated using (true);
create policy opp_read on public.onboarding_practice_progress for select to authenticated using (true);

create policy "wheel_config read" on public.wheel_config for select using (true);
create policy "wheel_segments read" on public.wheel_segments for select using (true);
create policy "wheel_spins own read" on public.wheel_spins for select using ((auth.uid() = user_id));

-- chat_members намеренно без правил: таблицу читает и пишет только бот
-- сервисным ключом, сотрудникам она не нужна.

-- ---------- Хранилище файлов ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('receipts', 'receipts', true, null, null),
 ('reward-photos', 'reward-photos', true, null, null),
 ('fund-photos', 'fund-photos', true, null, null),
 ('reward-suggestion-photos', 'reward-suggestion-photos', true, 8388608,
   array['image/png','image/jpeg','image/webp','image/gif']),
 ('onboarding-files', 'onboarding-files', true, 20971520,
   array['image/png','image/jpeg','image/webp','image/gif','image/heic','application/pdf',
         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select using ((bucket_id = 'receipts'::text));
create policy receipts_insert on storage.objects for insert with check (((bucket_id = 'receipts'::text) and (auth.uid() is not null)));
create policy reward_photos_public_read on storage.objects for select using ((bucket_id = 'reward-photos'::text));
create policy fund_photos_public_read on storage.objects for select using ((bucket_id = 'fund-photos'::text));
create policy reward_suggestion_photos_read on storage.objects for select using ((bucket_id = 'reward-suggestion-photos'::text));
create policy reward_suggestion_photos_insert on storage.objects for insert to authenticated with check (((bucket_id = 'reward-suggestion-photos'::text) and (auth.uid() is not null)));
create policy onboarding_files_read on storage.objects for select using ((bucket_id = 'onboarding-files'::text));
create policy onboarding_files_write on storage.objects for insert to authenticated with check (((bucket_id = 'onboarding-files'::text) and (exists (select 1 from users where ((users.id = auth.uid()) and (users.role = any (array['admin'::user_role, 'rop'::user_role])))))));
create policy onboarding_files_delete on storage.objects for delete to authenticated using (((bucket_id = 'onboarding-files'::text) and (exists (select 1 from users where ((users.id = auth.uid()) and (users.role = any (array['admin'::user_role, 'rop'::user_role])))))));

-- ---------- Стартовые строки ----------

-- Колесо без этой строки не открывается: оно читает настройки по id = true.
insert into public.wheel_config (id) values (true) on conflict (id) do nothing;
