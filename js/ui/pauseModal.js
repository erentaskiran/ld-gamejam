import { drawText, drawRect } from '../draw.js';
import { COLORS, UI_FONT, DESIGN_W, DESIGN_H } from './theme.js';
import { drawPanel } from './panel.js';
import { t, getLanguage, setLanguage } from '../i18n/index.js';
import { isScrollInverted, toggleScrollInverted } from '../input.js';

const LANGS = ['en', 'tr'];

const MODAL_W = 200;
const MODAL_H = 140;
const MODAL_X = (DESIGN_W - MODAL_W) / 2;
const MODAL_Y = (DESIGN_H - MODAL_H) / 2;

const BTN_W = 160;
const BTN_H = 24;
const BTN_X = MODAL_X + (MODAL_W - BTN_W) / 2;
const BTN_GAP = 6;
const BTN_START_Y = MODAL_Y + 44;

const BUTTONS = [
  { key: 'continue', labelKey: 'PAUSE_CONTINUE' },
  { key: 'settings', labelKey: 'PAUSE_SETTINGS' },
  { key: 'quit', labelKey: 'PAUSE_QUIT' },
];

function pointInRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function drawPauseModal(ctx, { mouse, selectedIndex = 0 }) {
  // Dimmed backdrop
  ctx.save();
  ctx.fillStyle = 'rgba(14, 9, 6, 0.78)';
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();

  drawPanel(ctx, MODAL_X, MODAL_Y, MODAL_W, MODAL_H, { border: COLORS.amber });

  drawText(ctx, t('PAUSE_TITLE'), MODAL_X + MODAL_W / 2, MODAL_Y + 16, {
    size: 13,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawRect(ctx, MODAL_X + 8, MODAL_Y + 26, MODAL_W - 16, 1, COLORS.amberDim);

  const rects = [];
  let keyboardIndex = 0;

  for (let i = 0; i < BUTTONS.length; i += 1) {
    const btn = BUTTONS[i];
    const btnY = BTN_START_Y + i * (BTN_H + BTN_GAP);
    const rect = { x: BTN_X, y: btnY, w: BTN_W, h: BTN_H, key: btn.key };
    if (!btn.disabled) {
      rects.push(rect);
    }

    const mouseHovered = !btn.disabled && pointInRect(mouse, rect);
    const keyFocused = !btn.disabled && keyboardIndex === selectedIndex;
    const active = mouseHovered || keyFocused;
    if (!btn.disabled) {
      keyboardIndex += 1;
    }

    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      border: btn.disabled ? COLORS.amberDim : active ? COLORS.amberBright : COLORS.amber,
      fill: active ? 'rgba(70, 42, 16, 0.75)' : COLORS.panelFillLight,
    });

    drawText(ctx, t(btn.labelKey), rect.x + rect.w / 2, rect.y + rect.h / 2, {
      size: 11,
      color: btn.disabled ? COLORS.amberDim : active ? COLORS.amberBright : COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
      align: 'center',
    });
  }

  return { rects };
}

const S_MODAL_W = 220;
const S_MODAL_H = 146;
const S_MODAL_X = (DESIGN_W - S_MODAL_W) / 2;
const S_MODAL_Y = (DESIGN_H - S_MODAL_H) / 2;

function cycleLanguage(dir) {
  const idx = LANGS.indexOf(getLanguage());
  setLanguage(LANGS[(idx + dir + LANGS.length) % LANGS.length]);
}

export function drawSettingsModal(ctx, { mouse }) {
  ctx.save();
  ctx.fillStyle = 'rgba(14, 9, 6, 0.78)';
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();

  drawPanel(ctx, S_MODAL_X, S_MODAL_Y, S_MODAL_W, S_MODAL_H, { border: COLORS.amber });

  drawText(ctx, t('SETTINGS_TITLE'), S_MODAL_X + S_MODAL_W / 2, S_MODAL_Y + 16, {
    size: 13,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawRect(ctx, S_MODAL_X + 8, S_MODAL_Y + 26, S_MODAL_W - 16, 1, COLORS.amberDim);

  // Language row
  const rowY = S_MODAL_Y + 55;
  drawText(ctx, t('SETTINGS_LANGUAGE_LABEL'), S_MODAL_X + 18, rowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const arrowW = 20;
  const arrowH = 20;
  const labelW = 80;
  const rowRight = S_MODAL_X + S_MODAL_W - 14;
  const labelCX = rowRight - labelW / 2 - arrowW - 4;
  const leftArrowX = labelCX - labelW / 2 - arrowW - 4;
  const rightArrowX = labelCX + labelW / 2 + 4;

  const leftRect = { x: leftArrowX, y: rowY - arrowH / 2, w: arrowW, h: arrowH };
  const rightRect = { x: rightArrowX, y: rowY - arrowH / 2, w: arrowW, h: arrowH };

  const leftHover = pointInRect(mouse, leftRect);
  const rightHover = pointInRect(mouse, rightRect);

  drawPanel(ctx, leftRect.x, leftRect.y, arrowW, arrowH, {
    border: leftHover ? COLORS.amberBright : COLORS.amberDim,
    fill: leftHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });
  drawText(ctx, '<', leftRect.x + arrowW / 2, rowY, {
    size: 12,
    color: leftHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawPanel(ctx, rightRect.x, rightRect.y, arrowW, arrowH, {
    border: rightHover ? COLORS.amberBright : COLORS.amberDim,
    fill: rightHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });
  drawText(ctx, '>', rightRect.x + arrowW / 2, rowY, {
    size: 12,
    color: rightHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const langLabel = getLanguage() === 'en' ? t('SETTINGS_LANGUAGE_EN') : t('SETTINGS_LANGUAGE_TR');
  drawText(ctx, langLabel, labelCX, rowY, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  const scrollRowY = rowY + 30;
  drawText(ctx, t('SETTINGS_SCROLL_LABEL'), S_MODAL_X + 18, scrollRowY, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const scrollRect = {
    x: rowRight - 76,
    y: scrollRowY - 10,
    w: 76,
    h: 20,
  };
  const scrollHover = pointInRect(mouse, scrollRect);
  drawPanel(ctx, scrollRect.x, scrollRect.y, scrollRect.w, scrollRect.h, {
    border: scrollHover ? COLORS.amberBright : COLORS.amberDim,
    fill: scrollHover ? 'rgba(60,36,14,0.8)' : COLORS.panelFillLight,
  });

  const scrollLabel = isScrollInverted() ? t('SETTINGS_SCROLL_ON') : t('SETTINGS_SCROLL_OFF');
  drawText(ctx, scrollLabel, scrollRect.x + scrollRect.w / 2, scrollRowY, {
    size: 11,
    color: scrollHover ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  drawText(ctx, t('SETTINGS_BACK'), S_MODAL_X + S_MODAL_W / 2, S_MODAL_Y + S_MODAL_H - 14, {
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
    align: 'center',
  });

  return {
    cycleLanguage,
    hitTest(mouse) {
      if (pointInRect(mouse, leftRect)) cycleLanguage(-1);
      else if (pointInRect(mouse, rightRect)) cycleLanguage(1);
      else if (pointInRect(mouse, scrollRect)) toggleScrollInverted();
    },
  };
}
