import { drawRect, drawText, wrapTextLines } from "../draw.js";
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

function buildLines(ctx, log, textW, size) {
  const lines = [];
  for (const entry of log) {
    if (!entry) {
      continue;
    }
    const color = colorForEntry(entry);
    const wrapped = wrapTextLines(ctx, entry, textW, size, UI_FONT);
    for (const line of wrapped) {
      lines.push({ text: line, color });
    }
  }
  return lines;
}

export function drawLogTab(ctx, x, y, w, h, count) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amberDim });
  drawText(ctx, `LOG (${count})`, x + w / 2, y + h / 2, {
    size: 16,
    color: COLORS.cream,
    align: "center",
    baseline: "middle",
    font: UI_FONT,
  });
}

export function drawLogPanel(ctx, x, y, w, h, log, scrollOffset) {
  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amber,
    fill: "rgba(14, 9, 6, 0.95)",
  });

  drawText(ctx, "[ LOG ]", x + 8, y + 14, {
    size: 16,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const textX = x + 8;
  const scrollbarW = 4;
  const textW = w - 16 - scrollbarW;
  const bodyTop = y + 28;
  const bodyHeight = h - 36;
  const size = 16;
  const lineH = 16;
  const maxLines = Math.max(1, Math.floor(bodyHeight / lineH));

  const allLines = buildLines(ctx, log, textW, size);
  const maxScroll = Math.max(0, allLines.length - maxLines);
  const clampedScroll = Math.min(Math.max(0, scrollOffset), maxScroll);
  const startIdx = Math.max(0, allLines.length - maxLines - clampedScroll);
  const visible = allLines.slice(startIdx, startIdx + maxLines);

  for (let i = 0; i < visible.length; i += 1) {
    drawText(ctx, visible[i].text, textX, bodyTop + i * lineH + 4, {
      size,
      color: visible[i].color,
      font: UI_FONT,
      baseline: "middle",
    });
  }

  if (maxScroll > 0) {
    const trackX = x + w - scrollbarW - 2;
    const trackY = bodyTop;
    const trackH = bodyHeight;
    drawRect(ctx, trackX, trackY, scrollbarW, trackH, COLORS.amberDim);
    const thumbH = Math.max(12, trackH * (maxLines / allLines.length));
    const thumbYRatio = maxScroll === 0 ? 0 : 1 - clampedScroll / maxScroll;
    const thumbY = trackY + (trackH - thumbH) * thumbYRatio;
    drawRect(ctx, trackX, thumbY, scrollbarW, thumbH, COLORS.amberBright);
  }

  return { clampedScroll, maxScroll };
}
