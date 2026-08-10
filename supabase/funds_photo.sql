-- ==========================================================
-- Фото для копилок (funds.image_url) + storage bucket
-- Выполнить в Supabase SQL Editor (Project > SQL Editor > New query)
-- ==========================================================

alter table public.funds add column image_url text;

-- Публичный бакет для фото копилок (загрузка идёт только через
-- server action с service-role ключом, поэтому отдельные storage-
-- политики на insert не нужны — service role их не проверяет).
insert into storage.buckets (id, name, public)
values ('fund-photos', 'fund-photos', true)
on conflict (id) do nothing;

-- Разрешаем публичное чтение файлов из этого бакета.
create policy "fund_photos_public_read" on storage.objects
  for select using (bucket_id = 'fund-photos');
