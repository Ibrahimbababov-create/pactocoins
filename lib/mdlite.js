// Мини-markdown → HTML для статей обучения. Вход — текст от админа/РОПа
// (полу-доверенный) и наши сиды, поэтому сначала экранируем HTML, потом
// разрешаем ограниченный набор разметки. Никаких зависимостей.

// Кавычки экранируем обязательно: ссылки ниже вставляются в href="…", и
// «"» внутри адреса позволял дописать атрибут вроде onfocus=… (скрипт у
// каждого, кто откроет статью, — включая админа в режиме просмотра).
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Готовые ссылки прячем за метками, пока размечаем жирный/курсив: иначе
// «_» из target="_blank" двух соседних ссылок (или из адреса с «_»)
// превращался в <em> и ломал разметку.
function inline(s) {
  const links = [];
  const stash = (html) => `\u0000${links.push(html) - 1}\u0000`;

  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, txt, url) =>
    stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`)
  );
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+)/g, (m, pre, url) =>
    pre + stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
  );
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<u>$1</u>");
  t = t.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

export function mdToHtml(md = "") {
  // Убираем ведущий заголовок первого уровня — название блока рисует UI.
  const src = String(md).replace(/\r\n/g, "\n").replace(/^\s*#\s+.*\n+/, "");
  const lines = src.split("\n");
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushAll();
      const lvl = Math.min(4, h[1].length + 1); // # -> h2
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushAll();
      out.push("<hr />");
      continue;
    }

    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    flushQuote();

    const ol = line.match(/^(\d+)[.)]\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol || ul) {
      flushPara();
      const want = ol ? "ol" : "ul";
      if (list && list !== want) flushList();
      if (!list) {
        list = want;
        out.push(`<${list}>`);
      }
      out.push(`<li>${inline((ol ? ol[2] : ul[1]))}</li>`);
      continue;
    }
    flushList();

    para.push(line.trim());
  }

  flushAll();
  return out.join("\n");
}
