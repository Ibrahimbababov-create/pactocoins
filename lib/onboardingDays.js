// Мета трёх учебных дней стажёра. Сам контент — блоки в onboarding_blocks.
export const ONBOARDING_DAYS = [
  {
    day: 1,
    title: "Ввод в должность / О продукте",
    subtitle: "Язык команды, взаимодействие, график, регламент, продукт проекта.",
  },
  {
    day: 2,
    title: "Основы продаж",
    subtitle: "Этапы сделки, потребности, презентация, возражения, закрытие, звонки.",
  },
  {
    day: 3,
    title: "Бизнес-процессы / Аттестация",
    subtitle: "Работа в AmoCRM, регламент CRM проекта и итоговая аттестация.",
  },
];

export const BLOCK_KIND = {
  article: { icon: "book", label: "Статья" },
  links: { icon: "link", label: "Ссылки" },
  test: { icon: "target", label: "Тест" },
};

export const BLOCK_OWNER = {
  admin: "Общий (админ)",
  rop: "От РОПа",
};
