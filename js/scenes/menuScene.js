import { drawRect, drawText, drawWrappedText, drawScrollableText } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, getPlatformScrollDelta, wasKeyPressed, wasMousePressed } from '../input.js';
import { clamp } from '../math.js';
import { CASES } from '../game/cases.js';
import { getStats } from '../game/caseStats.js';
import { getSelectedCaseData, setSelectedCase, state } from '../game/state.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t, getLanguage } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';

let menuAnim = 0;
let infoScrollOffset = 0;
let infoMaxScroll = 0;
let lastCaseIndex = -1;

function getVisibleCases() {
  const lang = getLanguage();
  return CASES.filter((c) => !c.language || c.language === lang);
}

function getVisibleIdx(visibleCases) {
  const currentDef = CASES[state.caseIndex];
  const idx = visibleCases.indexOf(currentDef);
  return idx >= 0 ? idx : 0;
}

function selectVisibleCase(visibleCases, visibleIdx) {
  const clamped = clamp(visibleIdx, 0, visibleCases.length - 1);
  const caseDef = visibleCases[clamped];
  if (caseDef) setSelectedCase(CASES.indexOf(caseDef));
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function parseLabel(label) {
  const dashIdx = label.indexOf(' - ');
  if (dashIdx < 0) {
    return { prefix: label, suffix: '' };
  }
  return {
    prefix: label.slice(0, dashIdx),
    suffix: label.slice(dashIdx + 3),
  };
}

function drawStatsPill(ctx, x, y, stats) {
  if (!stats || stats.attempts <= 0) {
    drawText(ctx, t('STAT_NEW'), x, y, {
      size: 9,
      color: COLORS.amberBright,
      font: UI_FONT,
      align: 'right',
      baseline: 'middle',
    });
    return;
  }
  const pillColor =
    stats.successes > 0 ? COLORS.success : stats.fails > 0 ? COLORS.fail : COLORS.amber;
  const label = `x${stats.attempts}`;
  ctx.font = `9px ${UI_FONT}`;
  const textW = ctx.measureText(label).width;
  const pillW = Math.max(18, textW + 8);
  const pillH = 10;
  const pillX = x - pillW;
  const pillY = y - pillH / 2;
  drawRect(ctx, pillX, pillY, pillW, pillH, pillColor);
  drawText(ctx, label, pillX + pillW / 2, pillY + pillH / 2 + 1, {
    size: 9,
    color: COLORS.ink,
    align: 'center',
    baseline: 'middle',
    font: UI_FONT,
  });
}

function drawCaseCard(ctx, x, y, w, h, opts) {
  const { number, prefix, suffix, selected, hovered, pulseT, stats } = opts;
  const borderColor = selected ? COLORS.amberBright : hovered ? COLORS.amber : COLORS.amberDim;
  const fillColor = selected
    ? 'rgba(60, 36, 14, 0.8)'
    : hovered
      ? 'rgba(30, 20, 10, 0.65)'
      : COLORS.panelFillLight;

  drawPanel(ctx, x, y, w, h, { border: borderColor, fill: fillColor });

  drawText(ctx, number, x + 12, y + h / 2, {
    size: 18,
    color: selected ? COLORS.amberBright : COLORS.amber,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, x + 36, y + 6, 1, h - 12, COLORS.amberDim);

  drawText(ctx, prefix, x + 44, y + 13, {
    size: 11,
    color: selected ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawStatsPill(ctx, x + w - 6, y + 13, stats);

  drawWrappedText(ctx, suffix, x + 44, y + 28, w - 52, {
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 11,
    maxLines: 2,
  });

  if (stats && stats.attempts > 0) {
    const breakdown = `${t('STAT_SHORT_CORRECT')} ${stats.successes}  ${t('STAT_SHORT_FAIL')} ${stats.fails}`;
    drawText(ctx, breakdown, x + w - 6, y + h - 6, {
      size: 9,
      color: stats.successes > 0 ? COLORS.success : COLORS.fail,
      font: UI_FONT,
      align: 'right',
      baseline: 'alphabetic',
    });
  }

  if (selected) {
    const pulse = 0.5 + 0.5 * Math.sin(pulseT * 3);
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.55;
    drawRect(ctx, x + 2, y + 2, w - 4, 1, COLORS.amberBright);
    drawRect(ctx, x + 2, y + h - 3, w - 4, 1, COLORS.amberBright);
    ctx.restore();
  }
}

function drawMenuScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 20;
  const panelY = 20;
  const panelW = DESIGN_W - 40;
  const panelH = DESIGN_H - 40;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  const titleP = smoothstep(clamp(menuAnim / 0.4, 0, 1));
  if (titleP > 0.01) {
    const titleY = -28 + (52 - -28) * titleP;
    ctx.save();
    ctx.globalAlpha = titleP;
    drawText(ctx, t('APP_TITLE'), DESIGN_W / 2, titleY, {
      align: 'center',
      size: 28,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }

  const subtitleP = smoothstep(clamp((menuAnim - 0.3) / 0.3, 0, 1));
  if (subtitleP > 0.01) {
    ctx.save();
    ctx.globalAlpha = subtitleP;
    drawText(ctx, t('MENU_CASE_SELECT'), DESIGN_W / 2, 78, {
      align: 'center',
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }

  state.menuCaseRects = [];
  const cardW = 192;
  const cardH = 44;
  const cardGap = 6;
  const listX = 28;
  const listStartY = 96;
  const mouse = getMousePos();

  const visibleCases = getVisibleCases();
  const visibleIdx = getVisibleIdx(visibleCases);

  if (visibleCases.length === 0) {
    const noP = smoothstep(clamp((menuAnim - 0.5) / 0.35, 0, 1));
    if (noP > 0.01) {
      ctx.save();
      ctx.globalAlpha = noP;
      drawText(ctx, t('MENU_NO_CASES'), listX + cardW / 2, listStartY + 24, {
        align: 'center',
        size: 11,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'middle',
      });
      ctx.restore();
    }
  }

  for (let i = 0; i < visibleCases.length; i += 1) {
    const caseDef = visibleCases[i];
    const y = listStartY + i * (cardH + cardGap);
    const rect = { x: listX, y, w: cardW, h: cardH, index: i };
    state.menuCaseRects.push(rect);

    const cardStart = 0.5 + i * 0.12;
    const cardP = smoothstep(clamp((menuAnim - cardStart) / 0.35, 0, 1));
    if (cardP < 0.01) {
      continue;
    }

    const xOffset = (1 - cardP) * 16;
    const selected = i === visibleIdx;
    const interactive = cardP > 0.6;
    const hovered = interactive && inRect(mouse, rect);

    const { prefix, suffix } = parseLabel(caseDef.label);
    const numberStr = String(i + 1).padStart(2, '0');

    ctx.save();
    ctx.globalAlpha = cardP;
    drawCaseCard(ctx, listX - xOffset, y, cardW, cardH, {
      number: numberStr,
      prefix,
      suffix,
      selected,
      hovered,
      pulseT: menuAnim,
      stats: getStats(caseDef.id),
    });
    ctx.restore();
  }

  const infoP = smoothstep(clamp((menuAnim - 0.85) / 0.4, 0, 1));
  if (infoP > 0.01) {
    const caseData = getSelectedCaseData();
    const infoX = listX + cardW + 12;
    const infoW = DESIGN_W - infoX - 28;
    const infoBaseY = listStartY;
    const infoH = DESIGN_H - listStartY - 56;
    const infoYOffset = (1 - infoP) * 14;
    const infoY = infoBaseY + infoYOffset;

    ctx.save();
    ctx.globalAlpha = infoP;
    drawPanel(ctx, infoX, infoY, infoW, infoH, { border: COLORS.amberDim });

    if (caseData) {
      drawText(ctx, caseData.title, infoX + infoW / 2, infoY + 14, {
        align: 'center',
        size: 12,
        color: COLORS.amberBright,
        font: UI_FONT,
        baseline: 'middle',
      });
      const scrollResult = drawScrollableText(
        ctx,
        caseData.context,
        infoX + 12,
        infoY + 32,
        infoW - 24,
        infoH - 40,
        infoScrollOffset,
        {
          size: 12,
          color: COLORS.cream,
          font: UI_FONT,
          lineHeight: 12,
          scrollbarTrackColor: COLORS.amberDim,
          scrollbarThumbColor: COLORS.amberBright,
        }
      );
      infoMaxScroll = scrollResult.maxScroll;
      infoScrollOffset = scrollResult.clampedScroll;
    } else {
      drawText(ctx, t('MENU_CASE_LOAD_ERROR'), infoX + infoW / 2, infoY + infoH / 2, {
        align: 'center',
        size: 12,
        color: COLORS.fail,
        font: UI_FONT,
        baseline: 'middle',
      });
    }

    ctx.restore();
  }

  const promptP = smoothstep(clamp((menuAnim - 1.2) / 0.3, 0, 1));
  if (promptP > 0.01) {
    ctx.save();
    ctx.globalAlpha = promptP * 0.6;
    drawText(ctx, t('MENU_SETTINGS_HINT'), DESIGN_W - 28, DESIGN_H - 28, {
      align: 'right',
      size: 10,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = promptP;
    drawText(
      ctx,
      `1-${visibleCases.length} / ${t('MENU_KEY_INSTRUCTIONS')}`,
      DESIGN_W / 2,
      DESIGN_H - 44,
      {
        align: 'center',
        size: 12,
        color: COLORS.creamDim,
        font: UI_FONT,
        baseline: 'middle',
      }
    );
    ctx.restore();

    const blink = 0.45 + 0.55 * Math.abs(Math.sin(menuAnim * 2.6));
    ctx.save();
    ctx.globalAlpha = promptP * blink;
    drawText(ctx, t('MENU_ENTER_START'), DESIGN_W / 2, DESIGN_H - 28, {
      align: 'center',
      size: 12,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }
}

export function registerMenuScene(_canvas, ctx) {
  registerScene('menu', {
    enter() {
      menuAnim = 0;
      infoScrollOffset = 0;
      infoMaxScroll = 0;
      lastCaseIndex = -1;
      applyAmbientProfile('menu');

      const visible = getVisibleCases();
      if (visible.length > 0 && !visible.includes(CASES[state.caseIndex])) {
        setSelectedCase(CASES.indexOf(visible[0]));
      }
    },
    update(dt) {
      menuAnim += dt;

      if (state.caseIndex !== lastCaseIndex) {
        lastCaseIndex = state.caseIndex;
        infoScrollOffset = 0;
      }

      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        infoScrollOffset = clamp(infoScrollOffset + wheel / 30, 0, infoMaxScroll);
      }

      const visible = getVisibleCases();
      const vIdx = getVisibleIdx(visible);

      for (let i = 0; i < Math.min(visible.length, 9); i += 1) {
        if (wasKeyPressed(String(i + 1))) {
          selectVisibleCase(visible, i);
        }
      }
      if (
        wasKeyPressed('arrowleft') ||
        wasKeyPressed('arrowup') ||
        wasKeyPressed('a') ||
        wasKeyPressed('w')
      ) {
        selectVisibleCase(visible, vIdx - 1);
      }
      if (
        wasKeyPressed('arrowright') ||
        wasKeyPressed('arrowdown') ||
        wasKeyPressed('d') ||
        wasKeyPressed('s')
      ) {
        selectVisibleCase(visible, vIdx + 1);
      }

      if (wasMousePressed(0) && state.menuCaseRects.length > 0) {
        const mouse = getMousePos();
        for (const rect of state.menuCaseRects) {
          if (inRect(mouse, rect)) {
            selectVisibleCase(visible, rect.index);
            break;
          }
        }
      }

      if (wasKeyPressed('s')) {
        setScene('settings');
        return;
      }
      if (wasKeyPressed('enter') && state.gameData) {
        setScene('dossier');
      }
    },
    render() {
      drawMenuScene(ctx);
    },
  });
}
