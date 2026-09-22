/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        acid: {
          400: "#A3FF12",
          500: "#8cf000",
        },
        amber: {
          300: "#ffc966",
          400: "#FFB020",
          500: "#FFB020",
          600: "#d99418",
        },
        // Тёмная тема PactoCoins: dark.900 фон, dark.800 карточка,
        // dark.700 линия, dark.600 граница (см. блок C редизайна).
        dark: {
          900: "#07080A",
          800: "#101318",
          700: "#1B1F25",
          600: "#262C34",
          500: "#3a424d",
        },
        ink: {
          DEFAULT: "#F2F5EF",
          soft: "#8B929B",
          dim: "#767D87",
        },
        // Второстепенный/тусклый текст: остальной код исторически написан
        // на gray-* — переопределяем саму палитру вместо правки сотен
        // мест, чтобы весь "серый" текст в приложении стал фирменным.
        gray: {
          100: "#F2F5EF",
          200: "#d7dade",
          300: "#aeb4bc",
          400: "#8B929B",
          500: "#8B929B",
          600: "#767D87",
          700: "#565d66",
          800: "#3a4048",
          900: "#20242a",
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
