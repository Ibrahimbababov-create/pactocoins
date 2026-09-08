import { createAdminClient } from "@/lib/supabase-admin";
import OnboardingAdminEditor from "@/components/OnboardingAdminEditor";

export const dynamic = "force-dynamic";

export default async function AdminOnboardingPage() {
  const admin = createAdminClient();
  const [{ data: blocks }, { data: links }, { data: tests }, { data: questions }] =
    await Promise.all([
      admin.from("onboarding_blocks").select("*").order("day").order("sort"),
      admin.from("onboarding_links").select("*").is("rop_id", null).order("sort"),
      admin.from("onboarding_tests").select("id, day"),
      admin
        .from("onboarding_questions")
        .select("id, test_id, question, options, correct, sort")
        .order("sort"),
    ]);

  const linksByBlock = {};
  for (const l of links ?? []) {
    (linksByBlock[l.block_id] ||= []).push({
      id: l.id,
      title: l.title,
      url: l.url,
      note: l.note,
    });
  }

  const dayByTest = Object.fromEntries((tests ?? []).map((t) => [t.id, t.day]));
  const qByDay = {};
  for (const q of questions ?? []) {
    const day = dayByTest[q.test_id];
    if (!day) continue;
    (qByDay[day] ||= []).push({
      id: q.id,
      question: q.question,
      options: q.options,
      correct: q.correct,
    });
  }

  const enriched = (blocks ?? []).map((b) => ({
    id: b.id,
    day: b.day,
    title: b.title,
    owner: b.owner,
    kind: b.kind,
    source: b.source,
    telegraph_url: b.telegraph_url,
    body_md: b.body_md,
    links: linksByBlock[b.id] ?? [],
    questions: b.kind === "test" ? qByDay[b.day] ?? [] : [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Обучение новичков</h1>
        <p className="text-sm text-gray-500 mt-1">
          Общие блоки (глоссарий, взаимодействие, регламент, уроки продаж,
          инструкция AmoCRM) и дефолты для блоков РОПа. Материалы под конкретный
          проект РОП добавляет сам на своей странице «Материалы стажёрам».
        </p>
      </div>
      <OnboardingAdminEditor blocks={enriched} />
    </div>
  );
}
