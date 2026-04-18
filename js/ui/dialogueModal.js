import { drawText, drawWrappedText } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

export function drawDialogueModal(ctx, { x, y, w, h, question, answer }) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, "[ CEVAP ]", x + 8, y + 14, {
    size: 16,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const qLines = drawWrappedText(ctx, `SEN: ${question}`, x + 8, y + 34, w - 16, {
    size: 16,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 16,
    maxLines: 2,
  });

  if (answer) {
    const aStartY = y + 34 + qLines * 16 + 8;
    drawWrappedText(ctx, `OZAN: ${answer}`, x + 8, aStartY, w - 16, {
      size: 16,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 16,
      maxLines: 5,
    });
  }

  drawText(ctx, "ENTER ile atla", x + w - 8, y + h - 8, {
    size: 16,
    color: COLORS.creamDim,
    align: "right",
    font: UI_FONT,
    baseline: "alphabetic",
  });
}
