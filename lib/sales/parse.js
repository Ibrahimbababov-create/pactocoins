// Разбор таблиц оплат отдела продаж. Перенесено из дашборда arman-analytics
// (api/_analytics.js) — логика та же, проверенная на живых таблицах:
//  • даты читаем числами (как в Excel), иначе в Алматы продажи съезжают на день;
//  • «Доплата» входит в выручку, но не считается новой продажей (x: true);
//  • оплаты месяца берём только из таблиц «Оплаты» (есть лист «Общее»),
//    «Большая таблица» нужна лишь как запасной источник и для UTM —
//    иначе одна оплата удваивается.

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const low = (s) => String(s ?? "").trim().replace(/:$/, "").trim().toLowerCase();

function toDate(v) {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // серийный номер дня: отсчёт от 30.12.1899, как в Excel и Google Таблицах
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v || "").trim();
  let r = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (r) return `${r[3]}-${r[2].padStart(2, "0")}-${r[1].padStart(2, "0")}`;
  // «0810.2026» и «01.092026» — пропущена одна из точек
  r = s.match(/^(\d{2})\.?(\d{2})\.?(\d{4})$/);
  if (r) return `${r[3]}-${r[2]}-${r[1]}`;
  r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return r ? r[0] : null;
}

function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(
    String(v ?? "").replace(/\s/g, "").replace(/[^\d,.\-]/g, "").replace(",", ".")
  );
  return isNaN(n) ? 0 : n;
}

function rate(v) {
  if (typeof v === "number") return v > 1 ? v / 100 : v;
  const n = parseFloat(String(v ?? "").replace("%", "").replace(",", "."));
  return isNaN(n) ? 0 : n > 1 || String(v).includes("%") ? n / 100 : n;
}

const phone = (v) => String(v ?? "").split(/[,.]/)[0].replace(/\D/g, "").slice(-10);
const clean = (v) => {
  const s = String(v ?? "").trim();
  return s === "-" || s === "nan" ? "" : s;
};
const mgrName = (s) => String(s || "").replace(/\s*РОП$/, "").trim();
const okYear = (d) => d && +d.slice(0, 4) >= 2025 && +d.slice(0, 4) <= 2030;

// book: { sheetNames, sheets: { имя: строки[][] } }
// skipSheets — регулярки листов, которые не считаем (другие продукты и т.п.)
export function parseBook(book, { skipSheets = [] } = {}) {
  const deals = [];
  const ints = [];
  const po = [];
  const issues = []; // оплаты, которые не удалось разобрать, — РОП увидит, что поправить
  const plan = {};
  let leads = 0;
  let spend = 0;
  const isPay = book.sheetNames.some((n) => /^общее/i.test(n.trim()));

  book.sheetNames.forEach((sn) => {
    if (skipSheets.some((re) => re.test(sn.trim()))) return;
    const rows = book.sheets[sn] || [];

    if (/^общее/i.test(sn.trim())) {
      const hi = rows.findIndex(
        (r) => r.some((c) => low(c) === "план") && r.some((c) => low(c) === "менеджер")
      );
      if (hi >= 0) {
        const h = rows[hi].map(low);
        const mi = h.indexOf("менеджер");
        const pi = h.indexOf("план");
        for (let j = hi + 1; j < rows.length; j++) {
          const nm = String(rows[j][mi] || "").trim();
          if (!nm || /итог/i.test(nm)) break;
          const p = num(rows[j][pi]);
          if (p > 0) plan[mgrName(nm)] = p;
        }
      }
      rows.forEach((r, ri) =>
        r.forEach((c, ci) => {
          const t = low(c);
          if (/кол-во лидов/.test(t)) {
            const v = r.slice(ci + 1).map(num).find((x) => x > 0);
            if (v) leads = v;
          }
          if (/сумма затрат/.test(t) && rows[ri + 1]) {
            const nx = rows[ri + 1].slice(ci, ci + 3).map(num);
            spend = nx.find((x) => x > 10000) || 0;
          }
        })
      );
      return;
    }

    const hi = rows.findIndex((r) => {
      const h = r.map(low);
      return (
        (h.includes("дата продажи") &&
          (h.includes("фио") || h.includes("фио клиента") || h.includes("сумма продажи"))) ||
        (h.includes("статус") && h.includes("клиент"))
      );
    });
    if (hi < 0) return;

    let h = rows[hi].map(low);
    const ix = (...names) => {
      for (const x of names) {
        const i = h.indexOf(x);
        if (i >= 0) return i;
      }
      return -1;
    };
    const isPo = h.includes("статус") && h.includes("клиент") && !h.includes("дата продажи");
    const isInt = /интенсив/i.test(sn);

    for (let j = hi + 1; j < rows.length; j++) {
      const r = rows[j];
      if (r.map(low).includes("менеджер")) {
        h = r.map(low);
        continue;
      }
      const g = (i) => (i >= 0 ? r[i] ?? "" : "");
      const u = {
        src: clean(g(ix("utm_source"))).toLowerCase(),
        cmp: clean(g(ix("utm_campaign"))),
        cnt: clean(g(ix("utm_content"))),
      };

      if (isPo) {
        const d0 = toDate(g(ix("дата")));
        const d = okYear(d0) ? d0 : "";
        const m = mgrName(g(ix("менеджер")));
        if (!m || /автооплата/i.test(m) || m.toLowerCase() === "менеджер" || !clean(g(ix("клиент"))))
          continue;
        po.push({
          m,
          d,
          st: clean(g(ix("статус"))).replace("Вовзрат", "Возврат"),
          fr: clean(g(ix("откуда"))),
          src: u.src || "не указан",
          ph: phone(g(ix("номер", "телефон"))),
          n: clean(g(ix("клиент"))),
          url: clean(g(ix("ссылка в амо", "ссылка на амо", "ссылка на лид"))),
        });
        continue;
      }

      // ФИО бывает затёрто в заголовке — тогда узнаём клиента по телефону
      const fio = String(g(ix("фио", "фио клиента")) || g(ix("телефон"))).trim();
      const rawDate = g(ix("дата продажи"));
      const d = toDate(rawDate);
      const s = num(g(ix("сумма продажи")));
      if (!fio || !s) continue;
      if (!okYear(d)) {
        issues.push({ sheet: sn, row: j + 1, date: String(rawDate).slice(0, 20), s });
        continue;
      }
      const im = ix("менеджер");
      const m = im >= 0 ? mgrName(r[im]) : mgrName(sn);
      if (!m) continue;
      const tar = String(g(ix("тариф")));

      if (isInt || /завтрак|интенсив/i.test(tar)) {
        if (s <= 50000)
          ints.push({
            m,
            d,
            s,
            n: fio.split(/\s+/).slice(0, 2).join(" "),
            src: u.src || "не указан",
            ph: phone(g(ix("телефон"))),
          });
        continue;
      }

      // комиссия с опечаткой («1190%») обнулила бы выручку — такую не учитываем
      const k0 = rate(g(ix("комиссия")));
      const k = k0 >= 0 && k0 < 1 ? k0 : 0;
      // «Выручка» с опечаткой (больше суммы или меньше нуля) — считаем по комиссии
      const net0 = num(g(ix("выручка")));
      const net = net0 > 0 && net0 <= s ? net0 : 0;
      deals.push({
        m,
        n: fio.split(/\s+/).slice(0, 2).join(" "),
        d,
        c: toDate(g(ix("дата создания"))),
        po: low(g(ix("по"))) === "да",
        s,
        k,
        net: net || s * (1 - k),
        p: clean(g(ix("форма оплаты"))) || "—",
        t: /vip|вип/i.test(tar) ? "VIP" : "Групповой",
        b: num(g(ix("выплата"))),
        x: /доплат/i.test(String(g(ix("статус продажи")))),
        src: u.src || "не указан",
        cmp: u.cmp,
        cnt: u.cnt,
        ph: phone(g(ix("телефон"))),
        url: clean(g(ix("ссылка на амо", "ссылка на лид", "ссылка в амо"))),
      });
    }
  });

  return { deals, ints, po, plan, leads, spend, isPay, issues };
}

const mk = (d) => d.slice(0, 7);

function dedupe(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_RU[m - 1]} ${y}`;
}

// Список разобранных таблиц → { "YYYY-MM": данные месяца }
export function buildMonths(books) {
  const pay = books.filter((b) => b.isPay);
  const other = books.filter((b) => !b.isPay);

  // UTM по телефону: в таблицах «Оплаты» их часто нет, в «Большой таблице» есть
  const utm = {};
  books.forEach((b) =>
    [...b.deals, ...b.ints, ...b.po].forEach((x) => {
      if (x.ph && x.src && x.src !== "не указан" && !utm[x.ph]) utm[x.ph] = x;
    })
  );
  const fill = (x) => {
    x = { ...x };
    if ((!x.src || x.src === "не указан") && utm[x.ph]) {
      x.src = utm[x.ph].src;
      x.cmp = x.cmp || utm[x.ph].cmp;
      x.cnt = x.cnt || utm[x.ph].cnt;
    }
    return x;
  };

  const keys = new Set();
  books.forEach((b) => [...b.deals, ...b.ints].forEach((x) => keys.add(mk(x.d))));

  const out = {};
  let prevPlan = {};
  [...keys].sort().forEach((k) => {
    const payB = pay.filter((b) => b.deals.some((d) => mk(d.d) === k));
    const src = payB.length ? payB : other;
    const deals = dedupe(
      src.flatMap((b) => b.deals.filter((d) => mk(d.d) === k)),
      (d) => `${d.ph}|${d.d}|${d.s}|${d.m}`
    ).map(fill);
    const intSrc = payB.filter((b) => b.ints.some((i) => mk(i.d) === k));
    const ints = dedupe(
      (intSrc.length ? intSrc : books).flatMap((b) => b.ints.filter((i) => mk(i.d) === k)),
      (i) => `${i.ph || i.n}|${i.d}`
    ).map(fill);
    const po = dedupe(
      books.flatMap((b) => b.po.filter((p) => p.d && mk(p.d) === k)),
      (p) => `${p.ph}|${p.d}|${p.st}`
    );
    if (!deals.length && !ints.length) return;

    // план берём из таблицы месяца; если его ещё не завели — прошлый месяц
    const pb = payB.find((b) => Object.keys(b.plan).length);
    let plan = pb ? pb.plan : {};
    let inherited = false;
    if (!Object.keys(plan).length && Object.keys(prevPlan).length) {
      plan = { ...prevPlan };
      inherited = true;
    }
    prevPlan = plan;

    out[k] = {
      key: k,
      label: monthLabel(k),
      deals,
      ints,
      po,
      plan,
      inherited,
      leads: (payB.find((b) => b.leads) || {}).leads || 0,
      spend: (payB.find((b) => b.spend) || {}).spend || 0,
      fromPay: payB.length > 0,
    };
  });
  return out;
}
