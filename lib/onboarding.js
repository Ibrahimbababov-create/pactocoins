import { notifyUser } from "@/lib/notifyUser";
import { recordTeamEvent } from "@/lib/teamEvents";

// Если пользователь — стажёр, переводим его в МОПа 1 уровня. Вызывается
// после одобрения первой заявки на выручку. Тихо ничего не делает, если
// это не стажёр.
export async function maybeGraduateTrainee(admin, userId) {
  const { data: u } = await admin
    .from("users")
    .select("id, name, role, is_guest")
    .eq("id", userId)
    .single();

  if (!u || u.role !== "trainee") return { graduated: false };

  const { error } = await admin
    .from("users")
    .update({ role: "mop", level: 1 })
    .eq("id", userId)
    .eq("role", "trainee"); // защита от гонки
  if (error) {
    console.error("[graduate] failed:", error.message);
    return { graduated: false };
  }

  await notifyUser(
    admin,
    userId,
    "🎓 Поздравляем! Первая оплата прошла — ты закончил стажировку и стал МОПом 1 уровня.",
    "notify_requests"
  );

  if (!u.is_guest) {
    await recordTeamEvent(admin, {
      userId,
      userName: u.name ?? "Кто-то",
      kind: "level_up",
      title: "закончил стажировку — МОП 1 уровня",
      icon: "🎓",
    });
  }

  return { graduated: true };
}
