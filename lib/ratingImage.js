import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPeriodRanking } from "@/lib/topRanking";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";

const ACID = "#a3ff12";

// Читаем шрифт с диска (nodejs runtime) — fetch(new URL) на nodejs Next
// переписывает в относительный путь и ломается.
const robotoPromise = (async () => {
  try {
    return await readFile(new URL("../fonts/Roboto.ttf", import.meta.url));
  } catch {
    return readFile(join(process.cwd(), "fonts", "Roboto.ttf"));
  }
})();

const MEDAL = ["🥇", "🥈", "🥉"];
const fmt = (n) => Number(n).toLocaleString("ru-RU");

export async function renderRatingImage(admin, period) {
  const isMonth = period === "month";
  const cfg = isMonth ? MONTHLY_TOP : WEEKLY_TOP;
  const { rows, label } = await getPeriodRanking(admin, period);
  const top = rows.slice(0, 10);
  const roboto = await robotoPromise;

  const W = 900;
  const H = 200 + Math.max(top.length, 1) * 66 + 110;

  const el = {
    type: "div",
    props: {
      style: {
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "#f2f2f2",
        padding: "40px 44px",
        fontFamily: "Roboto",
      },
      children: [
        // header
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", marginBottom: 24 },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 44, fontWeight: 700 },
                  children: `🏆 Рейтинг · ${isMonth ? "месяц" : "неделя"}`,
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 24, color: "#8a8a8a", marginTop: 6 },
                  children: label,
                },
              },
            ],
          },
        },
        // rows
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", flex: 1 },
            children:
              top.length === 0
                ? [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", fontSize: 26, color: "#8a8a8a" },
                        children: "Пока никто ничего не набрал",
                      },
                    },
                  ]
                : top.map((r, i) => ({
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        height: 58,
                        marginBottom: 8,
                        padding: "0 20px",
                        borderRadius: 16,
                        backgroundColor: i < 3 ? "rgba(163,255,18,0.10)" : "#151515",
                        border: i < 3 ? "1px solid rgba(163,255,18,0.35)" : "1px solid #262626",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              width: 56,
                              fontSize: i < 3 ? 30 : 26,
                              fontWeight: 700,
                              color: "#8a8a8a",
                            },
                            children: i < 3 ? MEDAL[i] : String(i + 1),
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              flex: 1,
                              fontSize: 30,
                              fontWeight: i < 3 ? 700 : 400,
                              color: i < 3 ? ACID : "#f2f2f2",
                              overflow: "hidden",
                            },
                            children: r.name,
                          },
                        },
                        {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              fontSize: 30,
                              fontWeight: 700,
                            },
                            children: fmt(r.total),
                          },
                        },
                      ],
                    },
                  })),
          },
        },
        // footer: prizes
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid #262626",
              fontSize: 24,
              color: "#8a8a8a",
            },
            children: `Призы: 🥇 +${fmt(cfg.prizes[0])} · 🥈 +${fmt(
              cfg.prizes[1]
            )} · 🥉 +${fmt(cfg.prizes[2])}  —  от ${fmt(cfg.min)}`,
          },
        },
      ],
    },
  };

  const res = new ImageResponse(el, {
    width: W,
    height: H,
    fonts: [{ name: "Roboto", data: roboto, weight: 400, style: "normal" }],
  });
  return new Uint8Array(await res.arrayBuffer());
}
