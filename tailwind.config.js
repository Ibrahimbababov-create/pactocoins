/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        acid: {
          400: "#a3ff12",
          500: "#8cf000",
        },
        dark: {
          900: "#0a0a0a",
          800: "#141414",
          700: "#1e1e1e",
          600: "#2a2a2a",
        },
      },
    },
  },
  plugins: [],
};
