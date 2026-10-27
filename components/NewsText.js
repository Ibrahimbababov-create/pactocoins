// Текст новости: абзацы через пустую строку, ссылки кликабельны.
// Рисуем элементами React, без HTML-вставок, поэтому чужая разметка
// в тексте безопасна.
const URL_RE = /(https?:\/\/[^\s<]+)/g;

function splitTrailing(url) {
  const m = url.match(/[.,;:!?)»"'\]]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ""];
}

function Line({ text }) {
  const parts = text.split(URL_RE);
  return parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const [url, tail] = splitTrailing(p);
    return (
      <span key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-acid-400 underline underline-offset-2 break-all"
        >
          {url}
        </a>
        {tail}
      </span>
    );
  });
}

export default function NewsText({ text = "", className = "" }) {
  const paragraphs = String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line break-words">
          <Line text={p} />
        </p>
      ))}
    </div>
  );
}
