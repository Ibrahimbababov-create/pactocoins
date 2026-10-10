import { createAdminClient } from "@/lib/supabase-admin";

// Разовый перенос файлов со старого токийского Supabase во франкфуртский
// (одобрено Ибрагимом, октябрь 2026). Если токийский проект выключат,
// эти картинки и PDF пропали бы. Запускается ежедневным кроном; когда
// переносить нечего — ничего не делает, так что повторный запуск безопасен.
//
// Порядок для каждой ссылки: скачать из Токио → положить во Франкфурт по
// тому же пути и в бакет с тем же именем → только потом поменять ссылку.
// Не скачалось или не загрузилось — ссылка остаётся старой.
const TOKYO = "https://grawzgpmohbsvrzyeuou.supabase.co/storage/v1/object/public/";

const SOURCES = [
  { table: "rewards", column: "image_url" },
  { table: "reward_variants", column: "image_url" },
  { table: "reward_suggestions", column: "image_url" },
  { table: "funds", column: "image_url" },
  { table: "onboarding_links", column: "url" },
  { table: "revenue_requests", column: "receipt_url" },
];

export async function migrateTokyoStorage() {
  const admin = createAdminClient();
  const moved = [];
  const failed = [];

  for (const { table, column } of SOURCES) {
    const { data: rows, error } = await admin
      .from(table)
      .select(`id, ${column}`)
      .like(column, `${TOKYO}%`);
    if (error) {
      failed.push({ table, reason: error.message });
      continue;
    }

    for (const row of rows ?? []) {
      const oldUrl = row[column];
      const [bucket, ...rest] = oldUrl.slice(TOKYO.length).split("/");
      const path = decodeURIComponent(rest.join("/"));
      try {
        const res = await fetch(oldUrl);
        if (!res.ok) throw new Error(`скачивание: HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const body = await res.arrayBuffer();

        const { error: upErr } = await admin.storage
          .from(bucket)
          .upload(path, body, { contentType, upsert: true });
        if (upErr) throw new Error(`загрузка: ${upErr.message}`);

        const newUrl = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        const { error: updErr } = await admin
          .from(table)
          .update({ [column]: newUrl })
          .eq("id", row.id)
          .eq(column, oldUrl);
        if (updErr) throw new Error(`ссылка: ${updErr.message}`);

        moved.push(`${table}/${row.id}`);
      } catch (err) {
        failed.push({ table, id: row.id, reason: String(err?.message || err) });
      }
    }
  }

  if (moved.length || failed.length) {
    console.log("[migrateTokyoStorage]", JSON.stringify({ moved, failed }));
  }
  return { moved: moved.length, failed };
}
