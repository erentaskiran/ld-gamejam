import { drawRect, drawScrollableText, drawText, drawWrappedText, wrapTextLines } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, getPlatformScrollDelta, wasKeyPressed, wasMousePressed } from '../input.js';
import { getSelectedCaseDef, getSuspectLabel, state } from '../game/state.js';
import { recordAttempt } from '../game/caseStats.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { drawDossierPanel } from '../ui/dossierPanel.js';
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
let dossierScrollOffset = 0;
let dossierMaxScroll = 0;
let dossierViewportRect = null;
let summaryScrollOffset = 0;
let summaryMaxScroll = 0;
let summaryViewportRect = null;

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

  const allQuestionLines = wrapTextLines(ctx, evidence.question, textW - 24, 11, UI_FONT);
  const qLines = allQuestionLines.slice(0, 3);
  if (qLines.length > 0 && allQuestionLines.length > 3) {
    qLines[qLines.length - 1] = `${qLines[qLines.length - 1]}...`;
  }
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
  const answerLinesRoom = Math.max(1, Math.floor((textAreaBottom - (answerY + 11)) / 11));
  const allAnswerLines = wrapTextLines(ctx, evidence.answer || '', textW, 11, UI_FONT);
  const aLines = allAnswerLines.slice(0, answerLinesRoom);
  if (aLines.length > 0 && allAnswerLines.length > answerLinesRoom) {
    aLines[aLines.length - 1] = `${aLines[aLines.length - 1]}...`;
  }
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
  const areaX = panelX + 10;
  const areaY = panelY + 38;
  const areaW = panelW - 20;
  const areaH = panelH - (areaY - panelY) - buttonAreaH - 6;

  const splitGap = 8;
  const baseLeftW = 184;
  const leftW = Math.floor(baseLeftW * 1.1);
  const leftX = areaX;
  const rightX = leftX + leftW + splitGap;
  const rightW = areaW - leftW - splitGap;
  const baseSummaryH = 96;
  const summaryH = Math.floor(baseSummaryH * 1.1);
  const dossierY = areaY + summaryH + 6;
  const dossierH = areaH - summaryH - 6;

  drawPanel(ctx, leftX, areaY, leftW, summaryH, {
    border: COLORS.amberDim,
    fill: 'rgba(10, 6, 3, 0.5)',
  });

  const summaryInnerX = leftX + 6;
  const summaryInnerW = leftW - 14;
  let summaryCursorY = areaY + 6;

  drawText(ctx, t('VERDICT_SUMMARY_HEADER'), summaryInnerX, summaryCursorY, {
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'top',
  });
  summaryCursorY += 12;

  const caseDef = getSelectedCaseDef();
  const caseLabel = (caseDef?.label || '').toUpperCase();
  const caseLabelLines = drawWrappedText(
    ctx,
    caseLabel,
    summaryInnerX,
    summaryCursorY,
    summaryInnerW,
    {
      size: 10,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 10,
      maxLines: 2,
      baseline: 'top',
    }
  );
  summaryCursorY += Math.max(10, caseLabelLines * 10) + 4;

  drawText(ctx, t('DOSSIER_CASE_SUMMARY'), summaryInnerX, summaryCursorY, {
    size: 9,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'top',
  });
  summaryCursorY += 12;

  summaryViewportRect = {
    x: summaryInnerX,
    y: summaryCursorY,
    w: summaryInnerW,
    h: Math.max(20, areaY + summaryH - 6 - summaryCursorY),
  };
  const summaryScroll = drawScrollableText(
    ctx,
    state.gameData?.context || '',
    summaryViewportRect.x,
    summaryViewportRect.y,
    summaryViewportRect.w,
    summaryViewportRect.h,
    summaryScrollOffset,
    {
      size: 10,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 11,
      scrollbarTrackColor: COLORS.amberDim,
      scrollbarThumbColor: COLORS.amberBright,
    }
  );
  summaryMaxScroll = summaryScroll.maxScroll;
  summaryScrollOffset = summaryScroll.clampedScroll;

  dossierViewportRect = { x: leftX, y: dossierY, w: leftW, h: dossierH };
  const dossierScroll = drawDossierPanel(
    ctx,
    dossierViewportRect.x,
    dossierViewportRect.y,
    dossierViewportRect.w,
    dossierViewportRect.h,
    state.gameData?.dossier,
    state.gameData?.suspect,
    dossierScrollOffset
  );
  dossierMaxScroll = dossierScroll.maxScroll;
  dossierScrollOffset = dossierScroll.clampedScroll;

  const listX = rightX;
  const listY = areaY;
  const listW = rightW;
  const listH = areaH;

  drawPanel(ctx, listX, listY, listW, listH, {
    border: COLORS.amberDim,
    fill: 'rgba(10, 6, 3, 0.5)',
  });
  drawText(ctx, t('VERDICT_EVIDENCE_HEADER'), listX + 6, listY + 10, {
    size: 10,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const listHeaderH = 16;
  const listBodyY = listY + listHeaderH;
  const listBodyH = listH - listHeaderH;
  listViewportRect = { x: listX, y: listBodyY, w: listW, h: listBodyH };

  const scrollbarPad = 10;
  const columns = 1;
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
  listMaxScroll = Math.max(0, totalH - (listBodyH - 8));
  listScrollOffset = Math.max(0, Math.min(listMaxScroll, listScrollOffset));

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX + 2, listBodyY + 2, listW - 4, listBodyH - 4);
  ctx.clip();

  let cursorY = listBodyY + 4 - listScrollOffset;
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const idx = r * columns + c;
      if (idx >= evidence.length) break;
      if (cursorY + FIXED_ENTRY_H >= listBodyY && cursorY <= listBodyY + listBodyH) {
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
    const trackY = listBodyY + 2;
    const trackH = listBodyH - 4;
    drawRect(ctx, trackX, trackY, 3, trackH, COLORS.amberDim);
    const thumbH = Math.max(12, (trackH * listBodyH) / totalH);
    const thumbRatio = listMaxScroll === 0 ? 0 : listScrollOffset / listMaxScroll;
    const thumbY = trackY + (trackH - thumbH) * thumbRatio;
    drawRect(ctx, trackX, thumbY, 3, thumbH, COLORS.amberBright);
  }

  if (evidence.length === 0) {
    drawText(ctx, t('VERDICT_NO_RECORD'), listX + listW / 2, listBodyY + listBodyH / 2, {
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
      dossierScrollOffset = 0;
      dossierMaxScroll = 0;
      dossierViewportRect = null;
      summaryScrollOffset = 0;
      summaryMaxScroll = 0;
      summaryViewportRect = null;
      applyAmbientProfile('verdict');
    },
    update(dt) {
      anim += dt;

      const mouse = getMousePos();
      const wheel = getPlatformScrollDelta();
      if (wheel !== 0) {
        if (summaryMaxScroll > 0 && summaryViewportRect && inRect(mouse, summaryViewportRect)) {
          summaryScrollOffset = Math.max(
            0,
            Math.min(summaryMaxScroll, summaryScrollOffset + wheel / 30)
          );
        } else if (
          dossierMaxScroll > 0 &&
          dossierViewportRect &&
          inRect(mouse, dossierViewportRect)
        ) {
          dossierScrollOffset = Math.max(
            0,
            Math.min(dossierMaxScroll, dossierScrollOffset + wheel / 30)
          );
        } else if (listMaxScroll > 0 && (!listViewportRect || inRect(mouse, listViewportRect))) {
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
