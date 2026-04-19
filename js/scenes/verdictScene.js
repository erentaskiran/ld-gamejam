import { drawRect, drawScrollableText, drawText } from '../draw.js';
import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, getWheelDelta, wasKeyPressed, wasMousePressed } from '../input.js';
import { getSuspectLabel, state } from '../game/state.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';

const VERDICT_GUILTY = 'GUILTY';
const VERDICT_NOT_GUILTY = 'NOT_GUILTY';

let buttonRects = [];
let anim = 0;
let summaryScrollOffset = 0;
let summaryMaxScroll = 0;
let summaryBodyRect = null;

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function countSignalFlags(evidence) {
  let hrSpikes = 0;
  let gsrSurges = 0;
  let eegAnomalies = 0;
  let totalScore = 0;
  for (const ev of evidence) {
    totalScore += ev.score;
    if (['SPIKE', 'MAX_SPIKE', 'MAX', 'ERRATIC'].includes(ev.heartRate)) hrSpikes += 1;
    if (['SPIKE', 'SURGE', 'MAX'].includes(ev.gsr)) gsrSurges += 1;
    if (['CHAOTIC', 'ERRATIC', 'FLATLINE'].includes(ev.eeg)) eegAnomalies += 1;
  }
  return { hrSpikes, gsrSurges, eegAnomalies, totalScore };
}

function drawSignalBar(ctx, x, y, w, label, value, maxValue, color) {
  drawText(ctx, label, x, y + 3, {
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
  const barX = x + 78;
  const barW = w - 78 - 24;
  drawRect(ctx, barX, y - 2, barW, 7, COLORS.fearTrack);
  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  drawRect(ctx, barX, y - 2, Math.round(barW * ratio), 7, color);
  drawText(ctx, String(value), x + w - 16, y + 3, {
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    align: 'right',
    baseline: 'middle',
  });
}

function drawVerdictButton(ctx, rect, label, subtitle, hovered, accent) {
  const border = hovered ? accent : COLORS.amberDim;
  const fill = hovered ? 'rgba(60, 36, 14, 0.85)' : COLORS.panelFillLight;
  drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, { border, fill });
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + 18, {
    align: 'center',
    size: 16,
    color: hovered ? accent : COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawText(ctx, subtitle, rect.x + rect.w / 2, rect.y + 38, {
    align: 'center',
    size: 11,
    color: COLORS.creamDim,
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawVerdictScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 20;
  const panelY = 16;
  const panelW = DESIGN_W - 40;
  const panelH = DESIGN_H - 32;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  drawText(ctx, '[ HUKUM ASAMASI ]', DESIGN_W / 2, panelY + 14, {
    align: 'center',
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, `SANIK: ${getSuspectLabel()}`, DESIGN_W / 2, panelY + 32, {
    align: 'center',
    size: 11,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const outcome = state.interrogationOutcome;
  const summaryY = panelY + 52;
  const summaryH = 76;
  drawPanel(ctx, panelX + 14, summaryY, panelW - 28, summaryH, {
    border: COLORS.amberDim,
    fill: 'rgba(14, 9, 6, 0.6)',
  });
  drawText(ctx, 'SORGU OZETI', panelX + 24, summaryY + 12, {
    size: 11,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });
  if (outcome) {
    drawText(ctx, outcome.theme.toUpperCase(), panelX + 24, summaryY + 26, {
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    });
    const bodyX = panelX + 24;
    const bodyY = summaryY + 34;
    const bodyW = panelW - 52;
    const bodyH = summaryY + summaryH - bodyY - 4;
    const { clampedScroll, maxScroll } = drawScrollableText(
      ctx,
      outcome.resultText,
      bodyX,
      bodyY,
      bodyW,
      bodyH,
      summaryScrollOffset,
      {
        size: 11,
        lineHeight: 11,
        color: COLORS.creamDim,
        font: UI_FONT,
        scrollbarTrackColor: COLORS.amberDim,
        scrollbarThumbColor: COLORS.amberBright,
      }
    );
    summaryScrollOffset = clampedScroll;
    summaryMaxScroll = maxScroll;
    summaryBodyRect = { x: bodyX, y: bodyY, w: bodyW, h: bodyH };
  } else {
    summaryBodyRect = null;
    summaryMaxScroll = 0;
  }

  const sigY = summaryY + summaryH + 10;
  const sigH = 84;
  drawPanel(ctx, panelX + 14, sigY, panelW - 28, sigH, {
    border: COLORS.amberDim,
    fill: 'rgba(14, 9, 6, 0.6)',
  });
  drawText(ctx, 'POLIGRAF KANITLARI', panelX + 24, sigY + 12, {
    size: 11,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const flags = countSignalFlags(state.evidence);
  const totalQuestions = state.evidence.length;
  drawSignalBar(
    ctx,
    panelX + 24,
    sigY + 28,
    panelW - 48,
    'KALP',
    flags.hrSpikes,
    Math.max(1, totalQuestions),
    COLORS.pulse
  );
  drawSignalBar(
    ctx,
    panelX + 24,
    sigY + 42,
    panelW - 48,
    'GSR',
    flags.gsrSurges,
    Math.max(1, totalQuestions),
    COLORS.gsr
  );
  drawSignalBar(
    ctx,
    panelX + 24,
    sigY + 56,
    panelW - 48,
    'EEG',
    flags.eegAnomalies,
    Math.max(1, totalQuestions),
    COLORS.eeg
  );

  const fearRatio = state.maxFearBar > 0 ? state.fearBar / state.maxFearBar : 0;
  drawText(
    ctx,
    `KORKU BARI SON: ${Math.round(state.fearBar)}/${state.maxFearBar}  |  SORU: ${totalQuestions}  |  STRES PUANI: ${flags.totalScore}`,
    panelX + 24,
    sigY + 74,
    {
      size: 11,
      color: fearRatio > 0.6 ? COLORS.amberBright : COLORS.creamDim,
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  const promptY = sigY + sigH + 12;
  drawText(
    ctx,
    'POLIGRAFI OKUYUN. SANIGIN SUCLU OLDUGUNA KANI GETIRDINIZ MI?',
    DESIGN_W / 2,
    promptY,
    {
      align: 'center',
      size: 11,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: 'middle',
    }
  );

  const btnW = 180;
  const btnH = 54;
  const btnY = promptY + 16;
  const guiltyRect = {
    x: DESIGN_W / 2 - btnW - 12,
    y: btnY,
    w: btnW,
    h: btnH,
    verdict: VERDICT_GUILTY,
  };
  const notGuiltyRect = {
    x: DESIGN_W / 2 + 12,
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
    '[1] SUCLU',
    'Poligraf yalanlarini ele verdi',
    inRect(mouse, guiltyRect),
    COLORS.fail
  );
  drawVerdictButton(
    ctx,
    notGuiltyRect,
    '[2] SUCSUZ',
    'Yeterli delil yok',
    inRect(mouse, notGuiltyRect),
    COLORS.success
  );

  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(anim * 2.4));
  ctx.save();
  ctx.globalAlpha = pulse;
  drawText(
    ctx,
    '1 / 2 / MOUSE: HUKUM VER',
    DESIGN_W / 2,
    panelY + panelH - 14,
    {
      align: 'center',
      size: 11,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: 'middle',
    }
  );
  ctx.restore();
}

function submitVerdict(verdict) {
  state.verdict = verdict;
  setScene('result');
}

export function registerVerdictScene(_canvas, ctx) {
  registerScene('verdict', {
    enter() {
      anim = 0;
      buttonRects = [];
      summaryScrollOffset = 0;
      summaryMaxScroll = 0;
      summaryBodyRect = null;
    },
    update(dt) {
      anim += dt;
      const wheel = getWheelDelta();
      if (wheel !== 0 && summaryMaxScroll > 0) {
        const mouse = getMousePos();
        if (!summaryBodyRect || inRect(mouse, summaryBodyRect)) {
          summaryScrollOffset = Math.max(
            0,
            Math.min(summaryMaxScroll, summaryScrollOffset + wheel / 30)
          );
        }
      }
      if (wasKeyPressed('arrowup')) {
        summaryScrollOffset = Math.max(0, summaryScrollOffset - 1);
      }
      if (wasKeyPressed('arrowdown')) {
        summaryScrollOffset = Math.min(summaryMaxScroll, summaryScrollOffset + 1);
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
        const mouse = getMousePos();
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
