import { drawText, drawWrappedText } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

export function drawDialogueModal(ctx, { x, y, w, h, question, answer }) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, "[ CEVAP ]", x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const qLines = drawWrappedText(ctx, `SEN: ${question}`, x + 8, y + 24, w - 16, {
    size: 12,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 12,
    maxLines: 2,
  });

  if (answer) {
    const aStartY = y + 24 + qLines * 12 + 6;
    drawWrappedText(ctx, `OZAN: ${answer}`, x + 8, aStartY, w - 16, {
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 5,
    });
  }

  drawText(ctx, "ENTER ile atla", x + w - 8, y + h - 6, {
    size: 10,
    color: COLORS.creamDim,
    align: "right",
    font: UI_FONT,
    baseline: "alphabetic",
  });
}
