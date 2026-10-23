// Кастдев команды: вопросы и проверка ответов. Только данные и чистые
// функции, без доступа к базе, поэтому файл безопасно импортировать и в
// экран опроса (клиент), и на сервере.
//
// Типы вопросов:
//   single  один вариант из списка
//   multi   до max вариантов
//   scale   оценка 1–5 (low/high — подписи краёв)
//   nps     оценка 0–10
//   text    свободный ответ
//   grid    оценка 1–5 для каждой строки, 0 = «не пользуюсь»

export const SURVEY_ID = "castdev-2026-10";
export const SURVEY_REWARD_CHIPS = 30;
export const SURVEY_MINUTES = 3;
export const TEXT_MAX = 600;

export const GRID_ROWS_SECTIONS = [
  { id: "balance", label: "Баланс" },
  { id: "rating", label: "Рейтинг" },
  { id: "shop", label: "Магазин" },
  { id: "wheel", label: "Колесо фортуны" },
  { id: "tournaments", label: "Турниры" },
  { id: "history", label: "История" },
  { id: "team", label: "Команда и обучение" },
];

export const SURVEY_QUESTIONS = [
  {
    id: "role",
    section: "О тебе",
    type: "single",
    required: true,
    text: "Кто ты в команде?",
    options: ["МОП", "РОП", "Стажёр", "Наставник"],
  },
  {
    id: "tenure",
    section: "О тебе",
    type: "single",
    required: true,
    text: "Сколько ты уже в Pacto?",
    options: ["Меньше месяца", "От 1 до 3 месяцев", "Больше трёх месяцев"],
  },
  {
    id: "freq",
    section: "Как ты пользуешься",
    type: "single",
    required: true,
    text: "Как часто ты заходишь в PactoCoins?",
    options: ["Несколько раз в день", "Раз в день", "Пару раз в неделю", "Реже"],
  },
  {
    id: "sections",
    section: "Как ты пользуешься",
    type: "grid",
    required: true,
    text: "Насколько полезен каждый раздел?",
    hint: "От 1 (бесполезен) до 5 (очень нужен). Если не пользуешься, нажми «не пользуюсь».",
    rows: GRID_ROWS_SECTIONS,
  },
  {
    id: "motivation",
    section: "Что тебя мотивирует",
    type: "multi",
    max: 2,
    required: true,
    text: "Что мотивирует тебя больше всего?",
    hint: "Выбери до двух.",
    options: [
      "Коины за выручку",
      "Место в рейтинге",
      "Призы в магазине",
      "Игры и турниры",
      "Признание команды",
      "Реальные деньги, коины мне не так важны",
    ],
  },
  {
    id: "coins_clear",
    section: "Что тебя мотивирует",
    type: "scale",
    required: true,
    text: "Понятно ли, как считаются коины за выручку?",
    low: "Совсем непонятно",
    high: "Всё ясно",
  },
  {
    id: "coins_enough",
    section: "Что тебя мотивирует",
    type: "scale",
    required: true,
    text: "Хватает ли коинов за твою работу?",
    low: "Очень мало",
    high: "Более чем",
  },
  {
    id: "shop_wish",
    section: "Что тебя мотивирует",
    type: "text",
    required: false,
    text: "Чего в магазине не хватает? Ради чего ты бы реально копил?",
    placeholder: "Например: поездка, техника, сертификат…",
  },
  {
    id: "forms_easy",
    section: "Заявки и процессы",
    type: "scale",
    required: true,
    text: "Удобно ли подавать выручку и бонусы?",
    low: "Неудобно",
    high: "Очень удобно",
  },
  {
    id: "wait",
    section: "Заявки и процессы",
    type: "single",
    required: true,
    text: "Как долго ты обычно ждёшь одобрения?",
    options: ["Сразу или в течение часа", "В течение дня", "Дольше суток", "Я не подаю заявки"],
  },
  {
    id: "circle",
    section: "Заявки и процессы",
    type: "single",
    required: true,
    text: "Отметка прихода кружком в группе: как тебе?",
    options: [
      "Удобно, пусть так и остаётся",
      "Нормально, но можно проще",
      "Раздражает",
      "Я не отмечаюсь кружком",
    ],
  },
  {
    id: "games_like",
    section: "Игры и новое",
    type: "text",
    required: false,
    text: "Колесо и турниры: что понравилось, а что нет?",
    placeholder: "Пиши как есть",
  },
  {
    id: "want_more",
    section: "Игры и новое",
    type: "multi",
    max: 2,
    required: true,
    text: "Чего ты хочешь видеть в приложении больше?",
    hint: "Выбери до двух.",
    options: [
      "Турниры",
      "Мини-игры",
      "Достижения и уровни",
      "Свой персонаж-аватар",
      "Питомец, которого кормишь",
      "Больше призов в магазине",
    ],
  },
  {
    id: "pet",
    section: "Игры и новое",
    type: "single",
    required: true,
    text: "Питомец, которого нужно кормить за работу: что думаешь?",
    hint: "Он не умирает, а просто грустит, если забыл про него.",
    options: [
      "Круто, заходил бы каждый день",
      "Заглядывал бы иногда",
      "Мне это не нужно",
      "Лишнее, только отвлекает",
    ],
  },
  {
    id: "change_first",
    section: "Главное",
    type: "text",
    required: true,
    text: "Одна вещь, которую стоит убрать или изменить в первую очередь?",
    placeholder: "Что бесит, мешает или лишнее. Если нечего, напиши «нет»",
  },
  {
    id: "missing",
    section: "Главное",
    type: "text",
    required: false,
    text: "Одна вещь, которой тебе не хватает?",
    placeholder: "Чего не хватает в приложении или в самой работе",
  },
  {
    id: "nps",
    section: "Главное",
    type: "nps",
    required: true,
    text: "Насколько вероятно, что ты посоветуешь PactoCoins новому коллеге?",
    low: "Точно нет",
    high: "Точно да",
  },
];

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Есть ли по вопросу годный ответ. Нужен и экрану (кнопка «Дальше»), и
// серверу (что сохранять).
export function answerOk(q, v) {
  switch (q.type) {
    case "single":
      return typeof v === "string" && q.options.includes(v);
    case "multi":
      return (
        Array.isArray(v) &&
        v.length >= 1 &&
        v.length <= q.max &&
        new Set(v).size === v.length &&
        v.every((x) => q.options.includes(x))
      );
    case "scale":
      return isInt(v, 1, 5);
    case "nps":
      return isInt(v, 0, 10);
    case "grid":
      return (
        v &&
        typeof v === "object" &&
        q.rows.every((r) => isInt(v[r.id], 0, 5))
      );
    case "text": {
      if (typeof v !== "string") return false;
      const t = v.trim();
      if (q.required) return t.length >= 3;
      return t.length > 0;
    }
    default:
      return false;
  }
}

// Серверная проверка: оставляем только известные вопросы с годными
// ответами. Пропущенный обязательный вопрос — ошибка.
export function validateAnswers(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const clean = {};
  for (const q of SURVEY_QUESTIONS) {
    const v = q.type === "text" && typeof src[q.id] === "string" ? src[q.id].trim().slice(0, TEXT_MAX) : src[q.id];
    if (answerOk(q, v)) {
      if (q.type === "grid") {
        clean[q.id] = Object.fromEntries(q.rows.map((r) => [r.id, v[r.id]]));
      } else {
        clean[q.id] = v;
      }
    } else if (q.required) {
      return { error: `Не хватает ответа: «${q.text}»` };
    }
  }
  return { clean };
}
