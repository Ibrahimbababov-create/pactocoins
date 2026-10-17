// Текущее объявление в приложении. Меняем тут — обновляется и на дашборде,
// и в магазине. null — баннера нигде нет.
// hideWhenTournament: на главной не показываем, когда там уже есть карточка
// турнира (идёт запись или игра), чтобы не дублировать.
export const CURRENT_ANNOUNCEMENT = {
  storageKey: "cr-cup-2026-10",
  icon: "trophy",
  title: "Кубок Pacto по Clash Royale",
  text: "Вторник, 18:30, в офисе. Сохрани 300 коинов на взнос.",
  href: "/mop/games",
  hideWhenTournament: true,
};
