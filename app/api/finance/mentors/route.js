import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { almatyDayKey } from "@/lib/timezone";
import { getReleasedUpTo, isReleased } from "@/lib/mentorPiggy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Справка для финансовой таблицы: оплаты стажёров внутри 30-дневного окна
// наставника (ровно те, за которые наставнику начислены коины). Только
// чтение, отдаёт итоги, а не базу. Доступ по отдельному паролю
// FINANCE_SHEET_SECRET, его хранит скрипт таблицы.
//
// GET /api/finance/mentors            все месяцы
// GET /api/finance/mentors?month=2026-10   один месяц (по Алматы)
//
// Для Google-таблицы (формула IMPORTDATA не умеет заголовки): тот же пароль
// в адресе, ?key=..., и ?format=csv отдаёт оплаты плоской таблицей.
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(rows) {
  const head = "date,project,trainee,mentor,amount_kzt,coins,released";
  const lines = rows.map((r) =>
    [r.date, r.project, r.trainee, r.mentor, r.amount_kzt, r.coins, r.released ? 1 : 0]
      .map(csvCell)
      .join(",")
  );
  return new Response([head, ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request) {
  const secret = process.env.FINANCE_SHEET_SECRET;
  const url = new URL(request.url);
  const given =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ??
    url.searchParams.get("key");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const asCsv = url.searchParams.get("format") === "csv";

  const onlyMonth = url.searchParams.get("month");
  if (onlyMonth && !/^\d{4}-\d{2}$/.test(onlyMonth)) {
    return NextResponse.json({ error: "month=YYYY-MM" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: bonuses, error } = await admin
      .from("mentor_bonuses")
      .select("request_id, mentor_id, trainee_id, coins, created_at");
    if (error) throw error;
    if (!bonuses?.length) {
      return asCsv
        ? csvResponse([])
        : NextResponse.json({ ok: true, rows: [], months: {} });
    }

    const requestIds = [...new Set(bonuses.map((b) => b.request_id))];
    const personIds = [
      ...new Set(bonuses.flatMap((b) => [b.mentor_id, b.trainee_id])),
    ];

    const [{ data: requests }, { data: people }] = await Promise.all([
      admin
        .from("revenue_requests")
        .select("id, amount_kzt, earned_at, created_at, status")
        .in("id", requestIds),
      admin.from("users").select("id, name, project_id").in("id", personIds),
    ]);

    const projectIds = [
      ...new Set((people ?? []).map((p) => p.project_id).filter(Boolean)),
    ];
    const { data: projects } = projectIds.length
      ? await admin.from("projects").select("id, name").in("id", projectIds)
      : { data: [] };

    const requestById = new Map((requests ?? []).map((r) => [r.id, r]));
    const personById = new Map((people ?? []).map((p) => [p.id, p]));
    const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

    // Высыпана ли запись: старше отметки последнего «сундука» (5-е число).
    const releasedUpTo = await getReleasedUpTo(admin);

    const rows = [];
    for (const b of bonuses) {
      const req = requestById.get(b.request_id);
      if (!req || req.status !== "approved") continue;
      const date = almatyDayKey(req.earned_at ?? req.created_at);
      const month = date.slice(0, 7);
      if (onlyMonth && month !== onlyMonth) continue;
      const trainee = personById.get(b.trainee_id);
      const mentor = personById.get(b.mentor_id);
      rows.push({
        month,
        date,
        project: projectById.get(trainee?.project_id) ?? "",
        trainee: trainee?.name ?? "",
        mentor: mentor?.name ?? "",
        amount_kzt: req.amount_kzt,
        coins: b.coins,
        released: isReleased(b.created_at, releasedUpTo),
      });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Итоги по месяцам: сколько оплат стажёров в окне и сколько коинов
    // получили наставники. Коин ≈ 2 ₸ (как в lib/mentorBonus.js).
    // piggy_coins: ещё в копилке, released_coins: уже высыпано на баланс
    // (coins = сумма обоих).
    const months = {};
    for (const r of rows) {
      const m = (months[r.month] ??= {
        amount_kzt: 0,
        coins: 0,
        piggy_coins: 0,
        released_coins: 0,
      });
      m.amount_kzt += r.amount_kzt;
      m.coins += r.coins;
      if (r.released) m.released_coins += r.coins;
      else m.piggy_coins += r.coins;
    }

    if (asCsv) return csvResponse(rows);
    return NextResponse.json({ ok: true, rows, months });
  } catch (err) {
    console.error("[finance/mentors] failed:", err?.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
