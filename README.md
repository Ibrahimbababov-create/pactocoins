# PactoCoins

Внутренняя система коинов отдела продаж. Next.js + Tailwind + Supabase.

## Структура

```
app/
  login/          — страница входа
  mop/             — кабинет МОПа (баланс, рейтинг, история, магазин, покупки)
  admin/           — админка (сотрудники, заявки, магазин)
lib/               — клиенты Supabase (browser / server / admin)
components/        — переиспользуемые React-компоненты
supabase/          — SQL-скрипты (схема + seed-данные)
middleware.js      — защита роутов и разграничение по ролям
```

## 1. Настройка Supabase

1. Создать проект на supabase.com
2. SQL Editor → выполнить `supabase/schema.sql`
3. Authentication → Users → создать нужных пользователей (email + пароль,
   галка "Auto Confirm User")
4. Скопировать их UUID и вставить в `supabase/seed_users.sql`
   (заменить примерные UUID на реальные), выполнить в SQL Editor
5. (Опционально) выполнить `supabase/full_rewards_seed.sql` — добавит
   полный каталог наград из ТЗ (~60 наград); без этого шага в магазине
   будет только 10 базовых наград из schema.sql
6. Settings → API Keys — скопировать:
   - `Publishable key` (или `anon` `public` в старом интерфейсе)
   - `Secret key` (или `service_role` в старом интерфейсе) — никогда не
     публиковать этот ключ, только в серверных переменных окружения

## 2. Переменные окружения

Скопировать `.env.local.example` → `.env.local`, заполнить:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (Publishable key)
SUPABASE_SERVICE_ROLE_KEY=...       (Secret key, используется только в admin actions)
```

## 3. Запуск локально

```bash
npm install
npm run dev
```

Открыть http://localhost:3000

## 4. Деплой на Vercel

1. Импортировать репозиторий в Vercel
2. В Environment Variables вставить те же 3 переменные из `.env.local`
3. Deploy

## Роли

- **admin** — полный доступ к `/admin/*`: сотрудники, подтверждение заявок
  на выручку, управление покупками и магазином наград
- **mop** — доступ только к `/mop/*`: баланс, заявки на выручку, магазин,
  свои покупки

Роль хранится в таблице `public.users.role` и проверяется в middleware
на каждый запрос.

## Формула начисления

`1000 ₸ выручки = 1 coin`, начисляется только после подтверждения
заявки админом (кнопка "Подтвердить" на странице
`/admin/revenue-requests`).

## Логика баланса

- Покупка награды списывает coins сразу, создаёт заявку со статусом
  "Ожидает"
- Если админ отклоняет заявку на покупку — coins возвращаются на баланс
  автоматически
- Баланс никогда не уходит в минус (проверяется в server actions)
- Все изменения баланса логируются в таблицу `transactions`
 
