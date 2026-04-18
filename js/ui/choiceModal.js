import { drawText, wrapTextLines } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

export function drawChoiceModal(ctx, { x, y, w, h, choices, title = "SORU SEC" }) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, `[ ${title} ]`, x + 8, y + 14, {
    size: 16,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const rects = [];
  let cursor = y + 28;
  const lineH = 16;
  const gap = 4;
  const maxLines = 2;
  const btnPadY = 6;

  for (let i = 0; i < choices.length; i += 1) {
    const text = `${i + 1}. ${choices[i].question}`;
    const lines = wrapTextLines(ctx, text, w - 24, 16, UI_FONT).slice(0, maxLines);
    const btnH = Math.max(28, lines.length * lineH + btnPadY * 2);

    if (cursor + btnH > y + h - 6) {
      break;
    }

    drawPanel(ctx, x + 8, cursor, w - 16, btnH, {
      border: COLORS.amberDim,
      fill: COLORS.panelFillLight,
    });

    for (let j = 0; j < lines.length; j += 1) {
      drawText(ctx, lines[j], x + 14, cursor + btnPadY + 8 + j * lineH, {
        size: 16,
        color: COLORS.cream,
        font: UI_FONT,
        baseline: "middle",
      });
    }

    rects.push({ x: x + 8, y: cursor, w: w - 16, h: btnH, index: i });
    cursor += btnH + gap;
  }

  return rects;
}
