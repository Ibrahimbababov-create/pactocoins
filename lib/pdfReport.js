import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
import path from "path";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const ROW_HEIGHT = 24;

function loadRobotoBytes() {
  const fontPath = path.join(process.cwd(), "fonts", "Roboto.ttf");
  return readFileSync(fontPath);
}

// rows: [{ name, total }], уже отсортированные по total desc
export async function buildEarningsReportPdf({ title, rows }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = loadRobotoBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const black = rgb(0.08, 0.08, 0.08);
  const gray = rgb(0.45, 0.45, 0.45);
  const acid = rgb(0.55, 0.75, 0.05);

  function newPageIfNeeded(spaceNeeded) {
    if (y - spaceNeeded < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  page.drawText(title, {
    x: MARGIN,
    y,
    size: 20,
    font,
    color: black,
  });
  y -= 36;

  const colPlace = MARGIN;
  const colName = MARGIN + 50;
  const colTotal = PAGE_WIDTH - MARGIN - 100;

  page.drawText("Место", { x: colPlace, y, size: 11, font, color: gray });
  page.drawText("Сотрудник", { x: colName, y, size: 11, font, color: gray });
  page.drawText("Заработано", { x: colTotal, y, size: 11, font, color: gray });
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 20;

  rows.forEach((row, i) => {
    newPageIfNeeded(ROW_HEIGHT);

    page.drawText(String(i + 1), {
      x: colPlace,
      y,
      size: 12,
      font,
      color: black,
    });
    page.drawText(row.name, {
      x: colName,
      y,
      size: 12,
      font,
      color: black,
    });
    page.drawText(`${row.total.toLocaleString("ru-RU")} coins`, {
      x: colTotal,
      y,
      size: 12,
      font,
      color: acid,
    });

    y -= ROW_HEIGHT;
  });

  return pdfDoc.save();
}
