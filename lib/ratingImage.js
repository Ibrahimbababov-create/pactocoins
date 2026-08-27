import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPeriodRanking } from "@/lib/topRanking";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";

const ACID = "#a3ff12";
const GOLD = "#f5c518";
const SILVER = "#c9c9c9";
const BRONZE = "#cd7f32";
const RANK_COLOR = [GOLD, SILVER, BRONZE];

const robotoPromise = (async () => {
  let buf;
  try {
    buf = await readFile(new URL("../fonts/Roboto.ttf", import.meta.url));
  } catch {
    buf = await readFile(join(process.cwd(), "fonts", "Roboto.ttf"));
  }
  // Satori хочет чистый ArrayBuffer, а не Buffer-view.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
})();

const fmt = (n) => Number(n).toLocaleString("ru-RU");

function row(children, style) {
  return { type: "div", props: { style: { display: "flex", ...style }, children } };
}

export async function renderRatingImage(admin, period) {
  const isMonth = period === "month";
  const cfg = isMonth ? MONTHLY_TOP : WEEKLY_TOP;
  const { rows, label } = await getPeriodRanking(admin, period);
  const top = rows.slice(0, 10);
  const roboto = await robotoPromise;

  const W = 900;
  const H = 210 + Math.max(top.length, 1) * 66 + 96;

  const el = row(
    [
      // header
      row(
        [
          row([`Рейтинг — ${isMonth ? "месяц" : "неделя"}`], {
            fontSize: 46,
            fontWeight: 700,
          }),
          row([label], { fontSize: 24, color: "#8a8a8a", marginTop: 8 }),
        ],
        { flexDirection: "column", marginBottom: 26 }
      ),
      // rows
      row(
        top.length === 0
          ? [
              row(["Пока никто ничего не набрал"], {
                fontSize: 26,
                color: "#8a8a8a",
              }),
            ]
          : top.map((r, i) =>
              row(
                [
                  row([i < 3 ? String(i + 1) : String(i + 1)], {
                    width: 54,
                    fontSize: 30,
                    fontWeight: 700,
                    color: i < 3 ? RANK_COLOR[i] : "#7a7a7a",
                  }),
                  row([r.name], {
                    flex: 1,
                    fontSize: 30,
                    fontWeight: i < 3 ? 700 : 400,
                    color: i < 3 ? "#ffffff" : "#e5e5e5",
                    overflow: "hidden",
                  }),
                  row([fmt(r.total)], {
                    fontSize: 30,
                    fontWeight: 700,
                    color: i === 0 ? ACID : "#f2f2f2",
                  }),
                ],
                {
                  alignItems: "center",
                  height: 58,
                  marginBottom: 8,
                  padding: "0 22px",
                  borderRadius: 16,
                  backgroundColor: i < 3 ? "rgba(163,255,18,0.08)" : "#161616",
                  border:
                    i < 3
                      ? "1px solid rgba(163,255,18,0.30)"
                      : "1px solid #262626",
                }
              )
            ),
        { flexDirection: "column", flex: 1 }
      ),
      // footer
      row(
        [
          `Призы: 1 место +${fmt(cfg.prizes[0])} · 2 место +${fmt(
            cfg.prizes[1]
          )} · 3 место +${fmt(cfg.prizes[2])}   —   от ${fmt(cfg.min)}`,
        ],
        {
          marginTop: 22,
          paddingTop: 18,
          borderTop: "1px solid #262626",
          fontSize: 22,
          color: "#8a8a8a",
        }
      ),
    ],
    {
      width: W,
      height: H,
      flexDirection: "column",
      backgroundColor: "#0a0a0a",
      color: "#f2f2f2",
      padding: "42px 46px",
      fontFamily: "Roboto",
    }
  );

  const res = new ImageResponse(el, {
    width: W,
    height: H,
    fonts: [{ name: "Roboto", data: roboto, weight: 400, style: "normal" }],
  });
  return new Uint8Array(await res.arrayBuffer());
}
