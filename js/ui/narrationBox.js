import { drawText, drawWrappedText } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

export function drawNarrationBox(ctx, x, y, w, h, title, body) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, `[ ${String(title || "").toUpperCase()} ]`, x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  drawWrappedText(ctx, body, x + 8, y + 22, w - 16, {
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 12,
    maxLines: 2,
  });
}
