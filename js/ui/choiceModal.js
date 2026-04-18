import { drawText, wrapTextLines } from "../draw.js";
import { clamp } from "../math.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

function pointInRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function drawChoiceModal(ctx, { x, y, w, h, choices, mouse, animProgress = 1, title = "SORU SEC" }) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, `[ ${title} ]`, x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const rects = [];
  let cursor = y + 22;
  const fontSize = 12;
  const lineH = 12;
  const gap = 3;
  const maxLines = 2;
  const btnPadY = 4;
  const stagger = 0.18;
  const slideDuration = 0.4;
  const slideDistance = 10;
  const typeStart = 0.12;
  const typeCps = 70;

  for (let i = 0; i < choices.length; i += 1) {
    const text = `${i + 1}. ${choices[i].question}`;
    const lines = wrapTextLines(ctx, text, w - 20, fontSize, UI_FONT).slice(0, maxLines);
    const btnH = Math.max(22, lines.length * lineH + btnPadY * 2);

    if (cursor + btnH > y + h - 4) {
      break;
    }

    const rect = { x: x + 6, y: cursor, w: w - 12, h: btnH, index: i };
    rects.push(rect);

    const local = animProgress - i * stagger;
    const slideLocal = clamp(local / slideDuration, 0, 1);
    const slideEase = easeOutCubic(slideLocal);
    const alpha = slideEase;
    const yOffset = (1 - slideEase) * slideDistance;

    const typeElapsed = Math.max(0, local - typeStart);
    const totalChars = lines.reduce((acc, line) => acc + line.length, 0);
    const charsToShow = Math.min(totalChars, Math.floor(typeElapsed * typeCps));

    if (alpha > 0.01) {
      const drawY = rect.y + yOffset;
      const interactive = slideEase > 0.6;
      const hovered = interactive && pointInRect(mouse, rect);

      ctx.save();
      ctx.globalAlpha = alpha;

      drawPanel(ctx, rect.x, drawY, rect.w, rect.h, {
        border: hovered ? COLORS.amberBright : COLORS.amberDim,
        fill: hovered ? "rgba(70, 42, 16, 0.75)" : COLORS.panelFillLight,
      });

      let remaining = charsToShow;
      for (let j = 0; j < lines.length; j += 1) {
        if (remaining <= 0) {
          break;
        }
        const slice = lines[j].slice(0, remaining);
        drawText(ctx, slice, rect.x + 6, drawY + btnPadY + 6 + j * lineH, {
          size: fontSize,
          color: hovered ? COLORS.amberBright : COLORS.cream,
          font: UI_FONT,
          baseline: "middle",
        });
        remaining -= lines[j].length;
      }

      ctx.restore();
    }

    cursor += btnH + gap;
  }

  return rects;
}
