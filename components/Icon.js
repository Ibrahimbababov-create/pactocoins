// Единый набор тонких иконок вместо мешанины эмодзи и глифов.
// Стиль: 24x24, обводка currentColor, без заливки. Lucide-подобные.

const PATHS = {
  home: "M4 11.5 12 4l8 7.5M6 10v10h4v-6h4v6h4V10",
  chart: "M4 4v16h16M8 14l3-4 3 2 5-7",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  bag: "M6.5 8h11l1 12h-13l1-12ZM9 8V6a3 3 0 0 1 6 0v2",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M9 14v6",
  award: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM9 12.5 7 21l5-2.5L17 21l-2-8.5",
  piggy:
    "M4 13a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6v2a2 2 0 0 1-2 2v2h-3v-2H9v2H6v-2a2 2 0 0 1-2-2v-2ZM15 6l1-2M4 12H2M9 12h.5",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6",
  mail: "M3 6h18v12H3V6ZM3 7l9 6 9-6",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9.6 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.4 1-1.4 2M12 17h.01",
  bell: "M6 9a6 6 0 0 1 12 0c0 4 2 5 2 5H4s2-1 2-5ZM10 20a2 2 0 0 0 4 0",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  fire: "M12 3s5 3.5 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s.2 1.8 2 2c0-3 2-5 2-8Z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6 6 18",
  megaphone: "M4 10v4a1 1 0 0 0 1 1h2l4 4V5L7 9H5a1 1 0 0 0-1 1ZM15 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14",
  link: "M9 15l6-6M8.5 12H7a4 4 0 0 1 0-8h3M15.5 12H17a4 4 0 0 1 0 8h-3",
  bot: "M9 4h6M12 4v3M6 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM9 12h.01M15 12h.01M9 16h6",
  users: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3 2.2-5 5-5s5 2 5 5M16 4.5a3.5 3.5 0 0 1 0 7M15 15c3 0 5 2 5 5",
  wallet: "M4 7h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4V7ZM4 7l1-3h11l1 3M16 13h.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  phone:
    "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2M12 6v6M9.5 9.5 12 12l2.5-2.5",
  check: "M5 13l4 4L19 7",
};

export default function Icon({ name, className = "w-5 h-5", strokeWidth = 1.75 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
