import { createAdminClient } from "@/lib/supabase-admin";
import { getAttendanceConfig, almatyClock } from "@/lib/attendance";
import { todayRangeAlmaty } from "@/lib/timezone";
import AttendanceAdminClient from "@/components/AttendanceAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const admin = createAdminClient();
  const { start, end } = todayRangeAlmaty();

  const [config, { data: people }, { data: today }] = await Promise.all([
    getAttendanceConfig(admin),
    admin
      .from("users")
      .select("id, name, role, rop_id")
      .in("role", ["mop", "rop", "trainee", "mentor"])
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    admin
      .from("bonus_requests")
      .select("id, user_id, status, comment, created_at, users(name)")
      .eq("category", "attendance")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Приход вовремя</h1>
        <p className="text-sm text-gray-400 mt-1">
          Ребята кидают кружок в тему «Приступил вовремя к работе». Успел до своего времени, крутка начисляется сама, под
          кружком появляется 👍. Позже, и заявка приходит тебе на решение, под кружком 👀.
        </p>
      </div>
      <AttendanceAdminClient
        config={config}
        employees={people ?? []}
        today={(today ?? []).map((r) => ({
          id: r.id,
          name: r.users?.name ?? "—",
          status: r.status,
          comment: r.comment,
          at: almatyClock(new Date(r.created_at)),
        }))}
      />
    </div>
  );
}
