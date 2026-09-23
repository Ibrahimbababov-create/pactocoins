/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Цвета живут в CSS-переменных (lib/themes.js) — так одна и та же
        // разметка перекрашивается целиком при смене темы. Формат "R G B"
        // нужен, чтобы работали прозрачности вида bg-acid-400/10.
        acid: {
          400: "rgb(var(--c-accent) / <alpha-value>)",
          500: "rgb(var(--c-accent-strong) / <alpha-value>)",
        },
        amber: {
          300: "rgb(var(--c-warn) / <alpha-value>)",
          400: "rgb(var(--c-warn) / <alpha-value>)",
          500: "rgb(var(--c-warn) / <alpha-value>)",
          600: "rgb(var(--c-warn) / <alpha-value>)",
        },
        dark: {
          900: "rgb(var(--c-bg) / <alpha-value>)",
          800: "rgb(var(--c-card) / <alpha-value>)",
          700: "rgb(var(--c-line) / <alpha-value>)",
          600: "rgb(var(--c-border) / <alpha-value>)",
          500: "rgb(var(--c-dim) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-text) / <alpha-value>)",
          soft: "rgb(var(--c-muted) / <alpha-value>)",
          dim: "rgb(var(--c-dim) / <alpha-value>)",
        },
        // Исторически по коду разбросан gray-* — переопределяем палитру,
        // чтобы весь «серый» текст тоже слушался темы.
        gray: {
          100: "rgb(var(--c-text) / <alpha-value>)",
          200: "rgb(var(--c-text) / <alpha-value>)",
          300: "rgb(var(--c-muted) / <alpha-value>)",
          400: "rgb(var(--c-muted) / <alpha-value>)",
          500: "rgb(var(--c-muted) / <alpha-value>)",
          600: "rgb(var(--c-dim) / <alpha-value>)",
          700: "rgb(var(--c-border) / <alpha-value>)",
          800: "rgb(var(--c-line) / <alpha-value>)",
          900: "rgb(var(--c-card) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-onest)", "system-ui", "sans-serif"],
        display: ["var(--font-unbounded)", "var(--font-onest)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    // В Telegram (и вообще на тачскрине) нет наведения мышкой — hover
    // остаётся "залипшим" после тапа. Ограничиваем все hover: классы
    // устройствами, которые реально умеют наводить (мышь/трекпад).
    function ({ addVariant }) {
      addVariant("hover", ["@media (hover: hover) and (pointer: fine) { &:hover }"]);
    },
  ],
};
