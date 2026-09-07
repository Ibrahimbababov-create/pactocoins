// Три учебных дня стажёра. Контент — дерево ссылок и коротких заметок
// (таблица onboarding_items), сгруппированных по дню и разделу.
export const ONBOARDING_DAYS = [
  {
    day: 1,
    title: "Ввод в должность",
    subtitle: "Язык команды, роли отдела, регламент, продукт и оферта.",
  },
  {
    day: 2,
    title: "Продажи и CRM",
    subtitle: "Методика продаж, этапы сделки, работа в CRM, звонки и скрипты.",
  },
  {
    day: 3,
    title: "Квалификация, возражения, аттестация",
    subtitle:
      "AAA / BBB / CCC, формула отработки возражений и аттестация «Финальный Босс».",
  },
];

// Тип материала → иконка + подпись (для трейни-виджета и редакторов).
export const ONBOARDING_TYPES = {
  link: { icon: "🔗", label: "Ссылка" },
  video: { icon: "🎬", label: "Видео" },
  doc: { icon: "📄", label: "Документ" },
  telegram: { icon: "💬", label: "Telegram" },
  presentation: { icon: "📊", label: "Презентация" },
  text: { icon: "📝", label: "Заметка" },
};

export const ONBOARDING_DONE_COLUMNS = {
  1: "onboarding_day1_done",
  2: "onboarding_day2_done",
  3: "onboarding_day3_done",
};

// Разбор формы материала обучения (общий для админа и РОПа).
export function parseOnboardingItem(formData) {
  const day = Number(formData.get("day"));
  if (![1, 2, 3].includes(day)) return { error: "Выбери день (1–3)" };

  const title = (formData.get("title")?.toString() || "").trim();
  if (!title) return { error: "Укажи название материала" };
  if (title.length > 200) return { error: "Слишком длинное название" };

  const type = (formData.get("type")?.toString() || "link").trim();
  if (!ONBOARDING_TYPES[type]) return { error: "Неизвестный тип материала" };

  let url = (formData.get("url")?.toString() || "").trim() || null;
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && url.length > 1000) return { error: "Слишком длинная ссылка" };

  const body = (formData.get("body")?.toString() || "").trim() || null;
  if (body && body.length > 4000) return { error: "Слишком длинный текст" };

  if (type !== "text" && !url && !body) {
    return { error: "Добавь ссылку или описание" };
  }

  const section = (formData.get("section")?.toString() || "")
    .trim()
    .slice(0, 120);
  const sortRaw = Number(formData.get("sort"));
  const sort = Number.isFinite(sortRaw) ? sortRaw : 0;

  return { fields: { day, title, type, url, body, section, sort } };
}

// Раскладываем плоский список onboarding_items в [{day, title, subtitle,
// sections: [{ name, items: [...] }]}]. Сортировка: по sort, потом по
// времени создания. Общие материалы идут раньше материалов РОПа.
export function groupOnboardingItems(items = []) {
  return ONBOARDING_DAYS.map((meta) => {
    const dayItems = items
      .filter((i) => i.day === meta.day)
      .sort((a, b) => {
        if (a.is_shared !== b.is_shared) return a.is_shared ? -1 : 1;
        if ((a.sort ?? 0) !== (b.sort ?? 0)) return (a.sort ?? 0) - (b.sort ?? 0);
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });

    const sections = [];
    for (const item of dayItems) {
      const name = item.section || "Материалы";
      let section = sections.find((s) => s.name === name);
      if (!section) {
        section = { name, items: [] };
        sections.push(section);
      }
      section.items.push(item);
    }

    return { ...meta, sections };
  });
}
