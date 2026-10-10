import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import TeamManageClient from "@/components/TeamManageClient";
import { getMonthEarnedMap } from "@/lib/earnings";
import {
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  thisWeekRangeAlmaty,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "rop" && profile?.role !== "admin") {
    redirect("/mop");
  }

  const admin = createAdminClient();
  const [{ data: mops }, { data: obBlocks }, { data: obProgress }] = await Promise.all([
    admin
      .from("users")
      .select("id, name, role, rop_id, total_earned")
      .in("role", ["mop", "trainee"])
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    admin
      .from("onboarding_blocks")
      .select("id, day, required, kind")
      .in("kind", ["article", "test"]),
    admin.from("onboarding_progress").select("user_id, block_id"),
  ]);

  const mineIds = (mops ?? []).filter((m) => m.rop_id === profile.id).map((m) => m.id);
  const month = monthRangeAlmaty(currentMonthKeyAlmaty());
  const week = thisWeekRangeAlmaty();
  // Последнюю оплату ищем за 120 дней: кто молчит дольше — и так «давно».
  const since = new Date(Date.now() - 120 * 86400000).toISOString();
  const noIds = mineIds.length === 0;

  const [monthEarnedMap, { data: monthRev }, { data: weekRev }, { data: approved }, { data: pending }] =
    await Promise.all([
      getMonthEarnedMap(admin, (mops ?? []).map((m) => m.id)),
      admin.rpc("rating_revenue", { p_start: month.start, p_end: month.end }),
      admin.rpc("rating_revenue", { p_start: week.start, p_end: week.end }),
      noIds
        ? Promise.resolve({ data: [] })
        : admin
            .from("revenue_requests")
            .select("user_id, earned_at, created_at")
            .eq("status", "approved")
            .in("user_id", mineIds)
            .gte("created_at", since),
      noIds
        ? Promise.resolve({ data: [] })
        : admin
            .from("revenue_requests")
            .select("user_id")
            .eq("status", "pending")
            .in("user_id", mineIds),
    ]);

  const toMap = (rows) =>
    Object.fromEntries((rows ?? []).map((r) => [r.user_id, Number(r.total) || 0]));
  const monthKzt = toMap(monthRev);
  const weekKzt = toMap(weekRev);
  const dealsMonth = Object.fromEntries(
    (monthRev ?? []).map((r) => [r.user_id, Number(r.deals) || 0])
  );
  const lastPaid = {};
  for (const r of approved ?? []) {
    const at = r.earned_at ?? r.created_at;
    if (!lastPaid[r.user_id] || at > lastPaid[r.user_id]) lastPaid[r.user_id] = at;
  }
  const pendingCount = {};
  for (const r of pending ?? []) pendingCount[r.user_id] = (pendingCount[r.user_id] ?? 0) + 1;

  // Пройденными считаем только обязательные блоки — те же, что в «всего».
  // Иначе необязательные статьи давали «День 1: 5/3».
  const dayOfBlock = Object.fromEntries(
    (obBlocks ?? []).filter((b) => b.required).map((b) => [b.id, b.day])
  );
  const totalByDay = { 1: 0, 2: 0, 3: 0 };
  for (const b of obBlocks ?? []) if (b.required) totalByDay[b.day]++;

  const progressByUser = {};
  for (const p of obProgress ?? []) {
    const day = dayOfBlock[p.block_id];
    if (!day) continue;
    ((progressByUser[p.user_id] ||= { 1: 0, 2: 0, 3: 0 })[day])++;
  }

  const withProgress = (m) => ({
    ...m,
    month_earned: monthEarnedMap[m.id] ?? 0,
    month_kzt: monthKzt[m.id] ?? 0,
    week_kzt: weekKzt[m.id] ?? 0,
    month_deals: dealsMonth[m.id] ?? 0,
    // Дни считаем здесь, на сервере: в браузере «сейчас» другое, и React
    // ругался бы на расхождение разметки.
    days_since_paid: lastPaid[m.id]
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lastPaid[m.id])) / 86400000))
      : null,
    pending: pendingCount[m.id] ?? 0,
    onboarding:
      m.role === "trainee"
        ? { done: progressByUser[m.id] ?? { 1: 0, 2: 0, 3: 0 }, total: totalByDay }
        : null,
  });

  // Сверху — кто больше принёс за месяц: РОПу так сразу видно, кого
  // подтянуть.
  const mine = (mops ?? [])
    .filter((m) => m.rop_id === profile.id)
    .map(withProgress)
    .sort((a, b) => b.month_kzt - a.month_kzt);
  // РОП может добавить только свободного МОПа. Админ — любого.
  const others = (mops ?? []).filter((m) =>
    profile.role === "admin" ? m.rop_id !== profile.id : !m.rop_id
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Моя команда</h1>
      <TeamManageClient mine={mine} others={others} monthLabel={month.label} />
    </div>
  );
}
