import { notifyUser } from "@/lib/notifyUser";
import { recordTeamEvent } from "@/lib/teamEvents";
import { mdToHtml } from "@/lib/mdlite";
import { telegraphToHtml } from "@/lib/telegraph";
import { ONBOARDING_DAYS } from "@/lib/onboardingDays";

// Если пользователь — стажёр, переводим его в МОПа 1 уровня. Вызывается
// после одобрения первой заявки на выручку.
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
    .eq("role", "trainee");
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

// ---- Загрузка программы обучения ----

// Приводит содержимое блока/версии РОПа к готовому HTML.
function resolveArticleHtml(row) {
  if (!row) return null;
  if (row.source === "telegraph" && Array.isArray(row.cached_content)) {
    return telegraphToHtml(row.cached_content);
  }
  if (row.body_md && row.body_md.trim()) return mdToHtml(row.body_md);
  return null;
}

// Полная программа для стажёра: дни → блоки с разрешённым контентом,
// ссылками, прогрессом и блокировками (гейтинг).
export async function getTraineeOnboarding(admin, userId, ropId) {
  const [{ data: blocks }, { data: ropBlocks }, { data: links }, { data: progress }] =
    await Promise.all([
      admin.from("onboarding_blocks").select("*").order("day").order("sort"),
      ropId
        ? admin.from("onboarding_rop_blocks").select("*").eq("rop_id", ropId)
        : Promise.resolve({ data: [] }),
      admin.from("onboarding_links").select("*").order("sort"),
      admin.from("onboarding_progress").select("block_id").eq("user_id", userId),
    ]);

  const ropByBlock = new Map((ropBlocks ?? []).map((r) => [r.block_id, r]));
  const doneSet = new Set((progress ?? []).map((p) => p.block_id));

  const linksByBlock = new Map();
  for (const l of links ?? []) {
    // общий блок — ссылки без rop_id; блок РОПа — ссылки его РОПа
    if (l.rop_id && l.rop_id !== ropId) continue;
    if (!linksByBlock.has(l.block_id)) linksByBlock.set(l.block_id, []);
    linksByBlock.get(l.block_id).push({ id: l.id, title: l.title, url: l.url, note: l.note });
  }

  const days = ONBOARDING_DAYS.map((meta) => {
    const dayBlocks = (blocks ?? [])
      .filter((b) => b.day === meta.day)
      .map((b) => {
        const ropRow = b.owner === "rop" ? ropByBlock.get(b.id) : null;
        let html = null;
        let blockLinks = [];
        if (b.kind === "article") {
          html = b.owner === "rop"
            ? resolveArticleHtml(ropRow) ?? resolveArticleHtml(b)
            : resolveArticleHtml(b);
        } else if (b.kind === "links") {
          blockLinks = linksByBlock.get(b.id) ?? [];
        }
        const hasContent =
          b.kind === "article" ? !!html : b.kind === "links" ? blockLinks.length > 0 : false;
        const done = doneSet.has(b.id);
        // Блокирует переход только блок с контентом. Пустой блок (РОП/админ
        // ещё не добавил материал) и тесты — не держат.
        const gates = b.required && b.kind !== "test" && hasContent;
        return {
          id: b.id,
          key: b.key,
          title: b.title,
          subtitle: b.subtitle,
          owner: b.owner,
          kind: b.kind,
          required: b.required,
          gates,
          html,
          links: blockLinks,
          hasContent,
          done,
        };
      });

    // гейтинг внутри дня: блок заблокирован, если предыдущий gates-блок не пройден
    let blocked = false;
    for (const b of dayBlocks) {
      b.locked = blocked;
      if (b.gates && !b.done) blocked = true;
    }

    const gatingBlocks = dayBlocks.filter((b) => b.gates);
    const doneCount = gatingBlocks.filter((b) => b.done).length;
    const complete = gatingBlocks.length > 0 && doneCount === gatingBlocks.length;

    return {
      ...meta,
      blocks: dayBlocks,
      doneCount,
      totalCount: gatingBlocks.length,
      complete,
    };
  });

  // день N закрыт, пока не завершён день N-1
  for (let i = 0; i < days.length; i++) {
    days[i].locked = i > 0 && !days[i - 1].complete;
  }

  return days;
}
