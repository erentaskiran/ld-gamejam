import { drawRect, drawText, wrapTextLines } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, getPlatformScrollDelta, wasKeyPressed, wasMousePressed } from '../input.js';
import { getSelectedCaseDef, getSuspectLabel, state } from '../game/state.js';
import { recordAttempt } from '../game/caseStats.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { t } from '../i18n/index.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { playCaseCloseSlam } from '../audio.js';

const VERDICT_GUILTY = 'GUILTY';
const VERDICT_NOT_GUILTY = 'NOT_GUILTY';

let buttonRects = [];
let anim = 0;
let listScrollOffset = 0;
let listMaxScroll = 0;
let listViewportRect = null;

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function drawMiniWave(ctx, x, y, w, h, samples, color) {
  drawRect(ctx, x, y, w, h, 'rgba(20, 12, 6, 0.55)');
  drawRect(ctx, x, y + h / 2, w, 1, 'rgba(70, 48, 22, 0.35)');
  if (!samples || samples.length < 2) {
    return;
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-3, max - min);
  const midY = y + h / 2;
  const halfH = (h - 2) / 2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i += 1) {
    const px = x + (i / (samples.length - 1)) * w;
    const norm = ((samples[i] - min) / span) * 2 - 1;
    const py = midY - norm * halfH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

const FIXED_ENTRY_H = 140;

function drawEvidenceEntry(ctx, x, y, w, h, index, evidence, marker) {
  drawPanel(ctx, x, y, w, h, {
    border: COLORS.amberDim,
    fill: 'rgba(14, 9, 6, 0.7)',
  });

  const padX = 6;
  const textW = w - padX * 2;
  const waveRowH = 10;
  const waveStackH = waveRowH * 3 + 4;
  const textAreaBottom = y + h - waveStackH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, w - 4, textAreaBottom - y - 2);
  ctx.clip();

  drawText(ctx, `Q${index + 1}`, x + padX, y + 10, {
    size: 11,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const qLines = wrapTextLines(ctx, evidence.question, textW - 24, 11, UI_FONT);
  for (let i = 0; i < qLines.length; i += 1) {
    drawText(ctx, qLines[i], x + padX + 24, y + 10 + i * 11, {
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const answerY = y + 10 + qLines.length * 11 + 6;
  drawText(ctx, `${getSuspectLabel()}:`, x + padX, answerY, {
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
  const aLines = wrapTextLines(ctx, evidence.answer || '', textW, 11, UI_FONT);
  for (let i = 0; i < aLines.length; i += 1) {
    drawText(ctx, aLines[i], x + padX, answerY + (i + 1) * 11, {
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
  }
  ctx.restore();

  const waveLabelW = 22;
  const waveX = x + padX + waveLabelW;
  const waveW = textW - waveLabelW;
  const waveStartY = y + h - waveRowH * 3 - 4;
  const samples = marker?.samples || { hr: [], breathing: [], gsr: [] };

  drawText(ctx, t('VERDICT_WAVE_HR'), x + padX, waveStartY + waveRowH / 2, {
    size: 9,
    color: COLORS.pulse,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(ctx, waveX, waveStartY, waveW, waveRowH, samples.hr, COLORS.pulse);

  drawText(ctx, t('VERDICT_WAVE_BREATHING'), x + padX, waveStartY + waveRowH + waveRowH / 2, {
    size: 9,
    color: COLORS.breathing,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(
    ctx,
    waveX,
    waveStartY + waveRowH,
    waveW,
    waveRowH,
    samples.breathing,
    COLORS.breathing
  );

  drawText(ctx, t('VERDICT_WAVE_GSR'), x + padX, waveStartY + waveRowH * 2 + waveRowH / 2, {
    size: 9,
    color: COLORS.gsr,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawMiniWave(ctx, waveX, waveStartY + waveRowH * 2, waveW, waveRowH, samples.gsr, COLORS.gsr);
}

function drawVerdictButton(ctx, rect, label, subtitle, hovered, accent) {
  const border = hovered ? accent : COLORS.amberDim;
  const fill = hovered ? 'rgba(60, 36, 14, 0.85)' : COLORS.panelFillLight;
  drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, { border, fill });
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + 14, {
    align: 'center',
    size: 14,
    color: hovered ? accent : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawText(ctx, subtitle, rect.x + rect.w / 2, rect.y + 30, {
    align: 'center',
    size: 10,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawVerdictScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 16;
  const panelY = 12;
  const panelW = DESIGN_W - 32;
  const panelH = DESIGN_H - 24;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  drawText(ctx, t('VERDICT_TITLE'), DESIGN_W / 2, panelY + 12, {
    align: 'center',
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, `${t('VERDICT_SUSPECT_PREFIX')}${getSuspectLabel()}`, DESIGN_W / 2, panelY + 26, {
    align: 'center',
    size: 10,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const btnH = 42;
  const buttonAreaH = btnH + 18;
  const listX = panelX + 10;
  const listY = panelY + 38;
  const listW = panelW - 20;
  const listH = panelH - (listY - panelY) - buttonAreaH - 6;
  listViewportRect = { x: listX, y: listY, w: listW, h: listH };

  drawPanel(ctx, listX, listY, listW, listH, {
    border: COLORS.amberDim,
    fill: 'rgba(10, 6, 3, 0.5)',
  });

  const scrollbarPad = 10;
  const columns = 2;
  const colGap = 6;
  const entryGap = 4;
  const sidePad = 5;
  const innerListW = listW - scrollbarPad - sidePad * 2;
  const entryW = Math.floor((innerListW - colGap * (columns - 1)) / columns);
  const col0X = listX + sidePad;
  const colX = (col) => col0X + col * (entryW + colGap);
  const evidence = state.evidence;
  const markers = state.polygraphMarkers;

  const rowCount = Math.ceil(evidence.length / columns);
  const totalH = rowCount * FIXED_ENTRY_H + Math.max(0, rowCount - 1) * entryGap;
  listMaxScroll = Math.max(0, totalH - (listH - 8));
  listScrollOffset = Math.max(0, Math.min(listMaxScroll, listScrollOffset));

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX + 2, listY + 2, listW - 4, listH - 4);
  ctx.clip();

  let cursorY = listY + 4 - listScrollOffset;
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const idx = r * columns + c;
      if (idx >= evidence.length) break;
      if (cursorY + FIXED_ENTRY_H >= listY && cursorY <= listY + listH) {
        drawEvidenceEntry(
          ctx,
          colX(c),
          cursorY,
          entryW,
          FIXED_ENTRY_H,
          idx,
          evidence[idx],
          markers[idx]
        );
      }
    }
    cursorY += FIXED_ENTRY_H + entryGap;
  }
  ctx.restore();

  if (listMaxScroll > 0 && totalH > 0) {
    const trackX = listX + listW - 5;
    const trackY = listY + 2;
    const trackH = listH - 4;
    drawRect(ctx, trackX, trackY, 3, trackH, COLORS.amberDim);
    const thumbH = Math.max(12, (trackH * listH) / totalH);
    const thumbRatio = listMaxScroll === 0 ? 0 : listScrollOffset / listMaxScroll;
    const thumbY = trackY + (trackH - thumbH) * thumbRatio;
    drawRect(ctx, trackX, thumbY, 3, thumbH, COLORS.amberBright);
  }

  if (evidence.length === 0) {
    drawText(ctx, t('VERDICT_NO_RECORD'), DESIGN_W / 2, listY + listH / 2, {
      align: 'center',
      size: 11,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    });
  }

  const btnW = 200;
  const btnY = panelY + panelH - btnH - 6;
  const guiltyRect = {
    x: DESIGN_W / 2 - btnW - 8,
    y: btnY,
    w: btnW,
    h: btnH,
    verdict: VERDICT_GUILTY,
  };
  const notGuiltyRect = {
    x: DESIGN_W / 2 + 8,
    y: btnY,
    w: btnW,
    h: btnH,
    verdict: VERDICT_NOT_GUILTY,
  };
  buttonRects = [guiltyRect, notGuiltyRect];

  const mouse = getMousePos();
  drawVerdictButton(
    ctx,
    guiltyRect,
    t('VERDICT_GUILTY_BTN'),
    t('VERDICT_GUILTY_SUB'),
    inRect(mouse, guiltyRect),
    COLORS.fail
  );
  drawVerdictButton(
    ctx,
    notGuiltyRect,
    t('VERDICT_NOT_GUILTY_BTN'),
    t('VERDICT_NOT_GUILTY_SUB'),
    inRect(mouse, notGuiltyRect),
    COLORS.success
  );

  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 2.4));
  ctx.save();
  ctx.globalAlpha = pulse;
  drawText(ctx, t('VERDICT_INSTRUCTIONS'), DESIGN_W / 2, btnY - 4, {
    align: 'center',
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });
  ctx.restore();
}

function submitVerdict(verdict) {
  playCaseCloseSlam(verdict === VERDICT_GUILTY ? 1 : 0.92);
  state.verdict = verdict;
  const correct = Boolean(state.trueVerdict) && verdict === state.trueVerdict;
  const caseDef = getSelectedCaseDef();
  if (caseDef?.id) {
    recordAttempt(caseDef.id, correct);
  }
  setScene('result');
}

export function registerVerdictScene(_canvas, ctx) {
  registerScene('verdict', {
    enter() {
      anim = 0;
      buttonRects = [];
      listScrollOffset = 0;
      listMaxScroll = 0;
      listViewportRect = null;
      applyAmbientProfile('verdict');
    },
    update(dt) {
      anim += dt;

      const mouse = getMousePos();
      const wheel = getPlatformScrollDelta();
      if (wheel !== 0 && listMaxScroll > 0) {
        if (!listViewportRect || inRect(mouse, listViewportRect)) {
          listScrollOffset = Math.max(0, Math.min(listMaxScroll, listScrollOffset + wheel / 30));
        }
      }
      if (wasKeyPressed('arrowup')) {
        listScrollOffset = Math.max(0, listScrollOffset - 12);
      }
      if (wasKeyPressed('arrowdown')) {
        listScrollOffset = Math.min(listMaxScroll, listScrollOffset + 12);
      }
      if (wasKeyPressed('1')) {
        submitVerdict(VERDICT_GUILTY);
        return;
      }
      if (wasKeyPressed('2')) {
        submitVerdict(VERDICT_NOT_GUILTY);
        return;
      }
      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }
      if (wasMousePressed(0)) {
        for (const rect of buttonRects) {
          if (inRect(mouse, rect)) {
            submitVerdict(rect.verdict);
            return;
          }
        }
      }
    },
    render() {
      drawVerdictScene(ctx);
    },
  });
}
