import { drawText, drawWrappedText, drawScrollableText } from '../draw.js';
import { COLORS, UI_FONT } from './theme.js';
import { drawPanel } from './panel.js';
import { t } from '../i18n/index.js';

export function drawDialogueModal(
  ctx,
  { x, y, w, h, question, answer, answerScrollOffset = 0, suspectLabel = t('DOSSIER_DEFAULT_NAME') }
) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  drawText(ctx, t('DIALOGUE_ANSWER_HEADER'), x + 8, y + 10, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const qLines = drawWrappedText(
    ctx,
    `${t('DIALOGUE_YOU_PREFIX')}${question}`,
    x + 8,
    y + 24,
    w - 16,
    {
      size: 12,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 2,
    }
  );

  const footerH = 14;
  let scrollResult = { clampedScroll: 0, maxScroll: 0 };

  if (answer) {
    const aStartY = y + 24 + qLines * 12 + 6;
    const aH = y + h - footerH - aStartY;
    scrollResult = drawScrollableText(
      ctx,
      `${suspectLabel}: ${answer}`,
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

  drawText(ctx, t('DIALOGUE_SKIP_HINT'), x + w - 8, y + h - 6, {
    size: 10,
    color: COLORS.creamDim,
    align: 'right',
    font: UI_FONT,
    baseline: 'alphabetic',
  });

  return scrollResult;
}
