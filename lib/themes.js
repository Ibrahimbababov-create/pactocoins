// Темы оформления. Значения — тройки RGB: так Tailwind умеет
// подмешивать прозрачность (bg-acid-400/10) к переменной CSS.
//
// Добавить новую тему = дописать сюда объект и строку в users_theme_check
// в базе. Ничего больше менять не нужно — все экраны берут цвета отсюда.

export const THEMES = {
  acid: {
    label: "Кислотный",
    hint: "Как было с самого начала",
    swatch: ["#07080A", "#A3FF12"],
    vars: {
      "--c-bg": "7 8 10",
      "--c-card": "16 19 24",
      "--c-line": "27 31 37",
      "--c-border": "38 44 52",
      "--c-accent": "163 255 18",
      "--c-accent-strong": "140 240 0",
      "--c-accent-ink": "7 8 10",
      "--c-text": "242 245 239",
      "--c-muted": "139 146 155",
      "--c-dim": "118 125 135",
      "--c-warn": "255 176 32",
      "--c-coin-1": "28 33 40",
      "--c-coin-2": "13 16 20",
      "--c-coin-3": "8 9 12",
    },
  },

  brass: {
    label: "Латунь",
    hint: "Тёплый уголь и металл",
    swatch: ["#141311", "#D89B3C"],
    vars: {
      "--c-bg": "20 19 17",
      "--c-card": "29 28 25",
      "--c-line": "42 40 36",
      "--c-border": "55 52 46",
      "--c-accent": "216 155 60",
      "--c-accent-strong": "196 137 48",
      "--c-accent-ink": "20 19 17",
      "--c-text": "243 239 231",
      "--c-muted": "154 147 138",
      "--c-dim": "122 115 106",
      "--c-warn": "196 89 59",
      "--c-coin-1": "42 38 32",
      "--c-coin-2": "23 21 18",
      "--c-coin-3": "16 15 13",
    },
  },

  indigo: {
    label: "Индиго",
    hint: "Ночное небо и бирюза",
    swatch: ["#0E1521", "#2ED3C0"],
    vars: {
      "--c-bg": "14 21 33",
      "--c-card": "23 32 46",
      "--c-line": "34 45 62",
      "--c-border": "46 59 78",
      "--c-accent": "46 211 192",
      "--c-accent-strong": "36 186 168",
      "--c-accent-ink": "5 35 33",
      "--c-text": "234 241 246",
      "--c-muted": "140 154 172",
      "--c-dim": "110 124 141",
      "--c-warn": "229 183 105",
      "--c-coin-1": "29 42 58",
      "--c-coin-2": "18 28 41",
      "--c-coin-3": "12 20 30",
    },
  },

  coral: {
    label: "Коралл",
    hint: "Слива и тёплый коралл",
    swatch: ["#16121B", "#FF6B5A"],
    vars: {
      "--c-bg": "22 18 27",
      "--c-card": "32 26 39",
      "--c-line": "44 36 52",
      "--c-border": "57 48 67",
      "--c-accent": "255 107 90",
      "--c-accent-strong": "232 88 72",
      "--c-accent-ink": "27 11 8",
      "--c-text": "244 239 246",
      "--c-muted": "156 147 168",
      "--c-dim": "123 114 136",
      "--c-warn": "255 196 107",
      "--c-coin-1": "43 34 52",
      "--c-coin-2": "27 21 34",
      "--c-coin-3": "19 15 25",
    },
  },
};

export const DEFAULT_THEME = "acid";
export const THEME_KEYS = Object.keys(THEMES);

export function isTheme(value) {
  return THEME_KEYS.includes(value);
}

export function themeOrDefault(value) {
  return isTheme(value) ? value : DEFAULT_THEME;
}

// Цвет фона темы в обычном hex — нужен Телеграму для шапки окна.
export function themeBgHex(key) {
  const [r, g, b] = THEMES[themeOrDefault(key)].vars["--c-bg"].split(" ");
  const hex = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// CSS для <style> в разметке: по одному блоку на тему.
export function themeStyleSheet() {
  return Object.entries(THEMES)
    .map(([key, theme]) => {
      const body = Object.entries(theme.vars)
        .map(([name, value]) => `${name}:${value}`)
        .join(";");
      const selector = key === DEFAULT_THEME ? `:root,[data-theme="${key}"]` : `[data-theme="${key}"]`;
      return `${selector}{${body}}`;
    })
    .join("");
}
