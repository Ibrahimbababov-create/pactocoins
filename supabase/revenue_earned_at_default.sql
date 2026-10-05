-- Дата оплаты (earned_at) у заявок на выручку.
-- С 29.09.2026 у заявок, одобренных кнопкой в Telegram, она оставалась пустой:
-- рейтинг это переживал (coalesce с created_at), а поиск в «Оплатах» по
-- периоду такие заявки не находил. Код теперь пишет дату всегда;
-- здесь — заполнить старые пустые и подстраховаться значением по умолчанию.
alter table public.revenue_requests alter column earned_at set default now();
update public.revenue_requests set earned_at = created_at where earned_at is null;
