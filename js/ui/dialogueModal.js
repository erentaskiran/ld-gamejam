import { drawText, drawWrappedText, drawScrollableText } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';

export function drawDialogueModal(ctx, { x, y, w, h, question, answer, answerScrollOffset = 0 }) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, '[ CEVAP ]', x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const qLines = drawWrappedText(ctx, `SEN: ${question}`, x + 8, y + 24, w - 16, {
    size: 12,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 12,
    maxLines: 2,
  });

  const footerH = 14;
  let scrollResult = { clampedScroll: 0, maxScroll: 0 };

  if (answer) {
    const aStartY = y + 24 + qLines * 12 + 6;
    const aH = y + h - footerH - aStartY;
    scrollResult = drawScrollableText(
      ctx,
      `OZAN: ${answer}`,
      x + 8,
      aStartY,
      w - 16,
      aH,
      answerScrollOffset,
      {
        size: 12,
        color: COLORS.cream,
        font: UI_FONT,
        lineHeight: 12,
        scrollbarTrackColor: COLORS.amberDim,
        scrollbarThumbColor: COLORS.amberBright,
      }
    );
  }

  drawText(ctx, 'ENTER ile atla', x + w - 8, y + h - 6, {
    size: 10,
    color: COLORS.creamDim,
    align: 'right',
    font: UI_FONT,
    baseline: 'alphabetic',
  });

  return scrollResult;
}
