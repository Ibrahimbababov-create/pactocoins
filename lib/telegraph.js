// Работа с telegra.ph: достаём путь из ссылки, тянем содержимое через
// официальный API и рендерим узлы в ограниченный HTML в стиле сайта.
// Результат кэшируется в onboarding_blocks/onboarding_rop_blocks.cached_content.

export function telegraphPath(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname === "telegra.ph" || u.hostname.endsWith(".telegra.ph")) {
      const p = u.pathname.replace(/^\/+/, "");
      return p || null;
    }
    // t.me/iv?url=...
    if (u.hostname === "t.me" && u.pathname === "/iv") {
      const inner = u.searchParams.get("url");
      return inner ? telegraphPath(inner) : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchTelegraphContent(url) {
  const path = telegraphPath(url);
  if (!path) return { ok: false, error: "Это не ссылка на telegra.ph" };
  try {
    const res = await fetch(
      `https://api.telegra.ph/getPage/${encodeURIComponent(path)}?return_content=true`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.error || "Страница не найдена" };
    return { ok: true, title: json.result.title, content: json.result.content || [] };
  } catch (e) {
    return { ok: false, error: "Не удалось получить страницу" };
  }
}

const ALLOWED = new Set([
  "p", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s",
  "a", "ul", "ol", "li", "blockquote", "figure", "figcaption",
  "img", "hr", "br", "aside", "pre", "code",
]);

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNode(node) {
  if (typeof node === "string") return esc(node);
  if (!node || !node.tag) return "";

  let tag = node.tag;
  if (tag === "h1" || tag === "h2") tag = "h3"; // заголовок блока — свой
  if (!ALLOWED.has(tag)) {
    return (node.children || []).map(renderNode).join("");
  }

  const kids = (node.children || []).map(renderNode).join("");

  if (tag === "br" || tag === "hr") return `<${tag} />`;

  if (tag === "img") {
    let src = node.attrs?.src || "";
    if (src.startsWith("/")) src = `https://telegra.ph${src}`;
    return `<img src="${esc(src)}" alt="" loading="lazy" />`;
  }
  if (tag === "a") {
    let href = node.attrs?.href || "";
    if (href.startsWith("/")) href = `https://telegra.ph${href}`;
    return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${kids}</a>`;
  }
  return `<${tag}>${kids}</${tag}>`;
}

export function telegraphToHtml(content = []) {
  return content.map(renderNode).join("\n");
}
