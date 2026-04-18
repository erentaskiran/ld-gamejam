import { drawText, wrapTextLines } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

function colorForEntry(entry) {
  if (entry.startsWith("SEN")) {
    return COLORS.creamDim;
  }
  if (entry.startsWith("OZAN")) {
    return COLORS.amberBright;
  }
  return COLORS.creamDim;
}

export function drawDialogLog(ctx, x, y, w, h, log) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amberDim });

  drawText(ctx, "[ LOG ]", x + 8, y + 14, {
    size: 16,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const textX = x + 8;
  const textW = w - 16;
  const bodyTop = y + 28;
  const bodyHeight = h - 32;
  const size = 16;
  const lineH = 16;
  const maxLines = Math.max(1, Math.floor(bodyHeight / lineH));

  const allLines = [];
  for (const entry of log) {
    if (!entry) {
      continue;
    }
    const color = colorForEntry(entry);
    const wrapped = wrapTextLines(ctx, entry, textW, size, UI_FONT);
    for (const line of wrapped) {
      allLines.push({ text: line, color });
    }
  }

  const visible = allLines.slice(-maxLines);
  for (let i = 0; i < visible.length; i += 1) {
    drawText(ctx, visible[i].text, textX, bodyTop + i * lineH, {
      size,
      color: visible[i].color,
      font: UI_FONT,
      baseline: "middle",
    });
  }
}
