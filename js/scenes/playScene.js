import { registerScene, setScene } from '../sceneManager.js';
import { getMousePos, getWheelDelta, wasKeyPressed, wasMousePressed } from '../input.js';
import { clamp, lerp } from '../math.js';
import {
  getSuspectLabel,
  pickChoice,
  resetRun,
  setNode,
  state,
  updateMarkerCapture,
} from '../game/state.js';
import { getBiometricDrawData, updateWave } from '../game/waves.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawNarrationBox } from '../ui/narrationBox.js';
import { drawPortraitBadge } from '../ui/portraitBadge.js';
import { drawPolygraph } from '../ui/polygraph.js';
import { drawChoiceModal } from '../ui/choiceModal.js';
import { drawDialogueModal } from '../ui/dialogueModal.js';
import { drawLogPanel, drawLogTab } from '../ui/dialogLog.js';
import { drawDossierPanel, drawDossierTab } from '../ui/dossierPanel.js';
import { DESIGN_H, DESIGN_W } from '../ui/theme.js';

const LAYOUT = {
  narration: { x: 8, y: 8, w: 518, h: 48 },
  operatorBadge: { x: 530, y: 4, w: 62, h: 56 },
  defendantBadge: { x: 8, y: 230, w: 62, h: 56 },
  modal: { x: 82, y: 154, w: 434, h: 132 },
  logTab: { x: DESIGN_W - 14, y: 94, w: 12, h: 84 },
  logPanel: { x: DESIGN_W - 196, y: 64, w: 192, h: 170 },
  dossierTab: { x: 2, y: 94, w: 12, h: 84 },
  dossierPanel: { x: 4, y: 64, w: 192, h: 220 },
  polygraph: { x: 0, y: 290, w: 600, h: 110 },
};

const QUESTION_CPS = 80;
const ANSWER_CPS = 55;
const FEAR_SMOOTH = 6;
const FEAR_FLASH_DECAY = 2;
const LOG_ANIM_SPEED = 12;
const PORTRAIT_SLIDE_SPEED = 2.5;
const NARRATION_SLIDE_SPEED = 4;
const NARRATION_CPS = 45;
const CHOICES_ANIM_SPEED = 1.6;
const POLYGRAPH_SLIDE_SPEED = 3;
const LANE_FLASH_DECAY = 1.8;

let logExpanded = false;
let logAnim = 0;
let logScrollOffset = 0;
let logMaxScroll = 0;
let dossierExpanded = false;
let dossierAnim = 0;
let dossierScrollOffset = 0;
let dossierMaxScroll = 0;
let answerScrollOffset = 0;
let answerMaxScroll = 0;
let choiceScrollOffset = 0;
let choiceMaxScroll = 0;
let portraitSlide = 0;
let narrationSlide = 0;
let narrationTextProgress = 0;
let choicesAnim = 0;
let polygraphSlide = 0;
let displayedNodeId = '';

const laneFlash = { heartRate: 0, eeg: 0, gsr: 0 };
const prevMetrics = { heartRate: '', eeg: '', gsr: '' };

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function inRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function drawConversationPortraits(ctx) {
  const slideE = easeOutCubic(clamp(portraitSlide, 0, 1));
  const opX = lerp(DESIGN_W, LAYOUT.operatorBadge.x, slideE);
  const defX = lerp(-LAYOUT.defendantBadge.w, LAYOUT.defendantBadge.x, slideE);

  drawPortraitBadge(
    ctx,
    opX,
    LAYOUT.operatorBadge.y,
    LAYOUT.operatorBadge.w,
    LAYOUT.operatorBadge.h,
    'operator',
    'OPERATOR'
  );

  drawPortraitBadge(
    ctx,
    defX,
    LAYOUT.defendantBadge.y,
    LAYOUT.defendantBadge.w,
    LAYOUT.defendantBadge.h,
    'defendant',
    getSuspectLabel()
  );
}

function drawPlayScene(ctx) {
  drawSceneBackground(ctx);

  drawConversationPortraits(ctx);

  const node = state.currentNode;
  if (node) {
    const narrEase = easeOutCubic(clamp(narrationSlide, 0, 1));
    const narrY = lerp(-LAYOUT.narration.h, LAYOUT.narration.y, narrEase);

    const titleStr = node.theme || '';
    const descStr = node.description || '';
    const titleLen = titleStr.length;
    const shown = Math.floor(narrationTextProgress);
    const titleSlice = titleStr.slice(0, Math.min(titleLen, shown));
    const descSlice = descStr.slice(0, Math.max(0, shown - titleLen));

    drawNarrationBox(
      ctx,
      LAYOUT.narration.x,
      narrY,
      LAYOUT.narration.w,
      LAYOUT.narration.h,
      titleSlice,
      descSlice
    );
  }

  const mouse = getMousePos();
  const textFullyRevealed = narrationTextProgress >= narrationTotalLen();

  if (state.responseMode && (state.lastQuestion || state.lastAnswer)) {
    const qVisible = state.lastQuestion.slice(0, Math.floor(state.questionProgress));
    const aVisible = state.lastAnswer.slice(0, Math.floor(state.answerProgress));
    const modalResult = drawDialogueModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      question: qVisible,
      answer: aVisible,
      answerScrollOffset,
      suspectLabel: getSuspectLabel(),
    });
    answerMaxScroll = modalResult.maxScroll;
    answerScrollOffset = modalResult.clampedScroll;
    state.choiceRects = [];
  } else if (textFullyRevealed && node && node.choices && !node.is_end_state) {
    const choiceResult = drawChoiceModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      choices: node.choices,
      mouse: logExpanded || dossierExpanded ? null : mouse,
      animProgress: choicesAnim,
      scrollOffset: choiceScrollOffset,
    });
    state.choiceRects = choiceResult.rects;
    choiceMaxScroll = choiceResult.maxScroll;
    choiceScrollOffset = choiceResult.clampedScroll;
  } else {
    state.choiceRects = [];
  }

  const polyE = easeOutCubic(clamp(polygraphSlide, 0, 1));
  const polyY = lerp(DESIGN_H, LAYOUT.polygraph.y, polyE);
  drawPolygraph(ctx, LAYOUT.polygraph.x, polyY, LAYOUT.polygraph.w, LAYOUT.polygraph.h, {
    waves: state.wave,
    time: state.time,
    metrics: state.metrics,
    biometric: getBiometricDrawData(state),
    fearBar: state.fearBarDisplay,
    maxFearBar: state.maxFearBar,
    fearFlash: state.fearFlash,
    laneFlash,
  });

  const ease = smoothstep(clamp(logAnim, 0, 1));
  const tabX = lerp(LAYOUT.logTab.x, LAYOUT.logPanel.x - LAYOUT.logTab.w - 2, ease);
  const tabRect = { x: tabX, y: LAYOUT.logTab.y, w: LAYOUT.logTab.w, h: LAYOUT.logTab.h };
  const tabHovered = inRect(mouse, tabRect);
  drawLogTab(ctx, tabX, LAYOUT.logTab.y, LAYOUT.logTab.w, LAYOUT.logTab.h, ease > 0.4, tabHovered);

  const dossEase = smoothstep(clamp(dossierAnim, 0, 1));
  const dossTabX = lerp(
    LAYOUT.dossierTab.x,
    LAYOUT.dossierPanel.x + LAYOUT.dossierPanel.w + 2,
    dossEase
  );
  const dossTabRect = {
    x: dossTabX,
    y: LAYOUT.dossierTab.y,
    w: LAYOUT.dossierTab.w,
    h: LAYOUT.dossierTab.h,
  };
  const dossTabHovered = inRect(mouse, dossTabRect);
  drawDossierTab(
    ctx,
    dossTabX,
    LAYOUT.dossierTab.y,
    LAYOUT.dossierTab.w,
    LAYOUT.dossierTab.h,
    dossEase > 0.4,
    dossTabHovered
  );

  if (ease > 0.01) {
    const panelRect = {
      x: lerp(DESIGN_W, LAYOUT.logPanel.x, ease),
      y: LAYOUT.logPanel.y,
      w: LAYOUT.logPanel.w,
      h: LAYOUT.logPanel.h,
    };
    ctx.save();
    ctx.globalAlpha = Math.min(1, ease * 1.25);
    const result = drawLogPanel(
      ctx,
      panelRect.x,
      panelRect.y,
      panelRect.w,
      panelRect.h,
      state.topLog,
      logScrollOffset
    );
    ctx.restore();
    if (ease > 0.95) {
      logMaxScroll = result.maxScroll;
      logScrollOffset = result.clampedScroll;
    }
  }

  if (dossEase > 0.01) {
    const panelRect = {
      x: lerp(-LAYOUT.dossierPanel.w, LAYOUT.dossierPanel.x, dossEase),
      y: LAYOUT.dossierPanel.y,
      w: LAYOUT.dossierPanel.w,
      h: LAYOUT.dossierPanel.h,
    };
    ctx.save();
    ctx.globalAlpha = Math.min(1, dossEase * 1.25);
    const result = drawDossierPanel(
      ctx,
      panelRect.x,
      panelRect.y,
      panelRect.w,
      panelRect.h,
      state.gameData?.dossier,
      state.gameData?.suspect,
      dossierScrollOffset
    );
    ctx.restore();
    if (dossEase > 0.95) {
      dossierMaxScroll = result.maxScroll;
      dossierScrollOffset = result.clampedScroll;
    }
  }
}

function narrationTotalLen() {
  const node = state.currentNode;
  if (!node) {
    return 0;
  }
  return (node.theme || '').length + (node.description || '').length;
}

function advanceToPendingNode() {
  if (!state.pendingNodeId) {
    return;
  }
  const result = setNode(state.pendingNodeId);
  if (!result.ok) {
    setScene('result');
    return;
  }
  if (result.isEnd) {
    state.interrogationOutcome = {
      nodeId: state.currentNodeId,
      theme: state.currentNode?.theme || '',
      description: state.currentNode?.description || '',
      resultText: state.currentNode?.result_text || '',
      wasSuccess: state.currentNodeId.includes('success'),
    };
    setScene('verdict');
  }
}

function updateLogHover(dt) {
  const mouse = getMousePos();
  const ease = smoothstep(clamp(logAnim, 0, 1));
  const tabX = lerp(LAYOUT.logTab.x, LAYOUT.logPanel.x - LAYOUT.logTab.w - 2, ease);
  const liveTabRect = { x: tabX, y: LAYOUT.logTab.y, w: LAYOUT.logTab.w, h: LAYOUT.logTab.h };
  const panelRect = {
    x: LAYOUT.logPanel.x,
    y: LAYOUT.logPanel.y,
    w: LAYOUT.logPanel.w,
    h: LAYOUT.logPanel.h,
  };

  if (wasMousePressed(0)) {
    if (inRect(mouse, liveTabRect)) {
      logExpanded = !logExpanded;
      if (!logExpanded) {
        logScrollOffset = 0;
      }
    } else if (logExpanded && !inRect(mouse, panelRect)) {
      logExpanded = false;
      logScrollOffset = 0;
    }
  }

  const target = logExpanded ? 1 : 0;
  const diff = target - logAnim;
  logAnim += diff * Math.min(1, dt * LOG_ANIM_SPEED);
  if (Math.abs(diff) < 0.005) {
    logAnim = target;
  }

  if (logExpanded && inRect(mouse, panelRect)) {
    const wheel = getWheelDelta();
    if (wheel !== 0) {
      logScrollOffset = clamp(logScrollOffset - wheel / 30, 0, logMaxScroll);
    }
  }
}

function updateDossierHover(dt) {
  const mouse = getMousePos();
  const ease = smoothstep(clamp(dossierAnim, 0, 1));
  const tabX = lerp(
    LAYOUT.dossierTab.x,
    LAYOUT.dossierPanel.x + LAYOUT.dossierPanel.w + 2,
    ease
  );
  const liveTabRect = {
    x: tabX,
    y: LAYOUT.dossierTab.y,
    w: LAYOUT.dossierTab.w,
    h: LAYOUT.dossierTab.h,
  };
  const panelRect = {
    x: LAYOUT.dossierPanel.x,
    y: LAYOUT.dossierPanel.y,
    w: LAYOUT.dossierPanel.w,
    h: LAYOUT.dossierPanel.h,
  };

  if (wasMousePressed(0)) {
    if (inRect(mouse, liveTabRect)) {
      dossierExpanded = !dossierExpanded;
      if (!dossierExpanded) {
        dossierScrollOffset = 0;
      }
    } else if (dossierExpanded && !inRect(mouse, panelRect)) {
      dossierExpanded = false;
      dossierScrollOffset = 0;
    }
  }

  const target = dossierExpanded ? 1 : 0;
  const diff = target - dossierAnim;
  dossierAnim += diff * Math.min(1, dt * LOG_ANIM_SPEED);
  if (Math.abs(diff) < 0.005) {
    dossierAnim = target;
  }

  if (dossierExpanded && inRect(mouse, panelRect)) {
    const wheel = getWheelDelta();
    if (wheel !== 0) {
      dossierScrollOffset = clamp(dossierScrollOffset - wheel / 30, 0, dossierMaxScroll);
    }
  }
}

function tickFearAnimation(dt) {
  const diff = state.fearBar - state.fearBarDisplay;
  state.fearBarDisplay += diff * Math.min(1, dt * FEAR_SMOOTH);
  if (Math.abs(diff) < 0.05) {
    state.fearBarDisplay = state.fearBar;
  }
  state.fearFlash = Math.max(0, state.fearFlash - dt * FEAR_FLASH_DECAY);
}

function handleResponseMode(dt) {
  const qLen = state.lastQuestion.length;
  const aLen = state.lastAnswer.length;
  const qDone = state.questionProgress >= qLen;
  const aDone = state.answerProgress >= aLen;

  if (wasKeyPressed('enter')) {
    if (!qDone) {
      state.questionProgress = qLen;
      return;
    }
    if (!aDone) {
      state.answerProgress = aLen;
      return;
    }
    advanceToPendingNode();
    return;
  }

  if (!qDone) {
    state.questionProgress = Math.min(qLen, state.questionProgress + dt * QUESTION_CPS);
    return;
  }

  if (!aDone) {
    state.answerProgress = Math.min(aLen, state.answerProgress + dt * ANSWER_CPS);
    return;
  }

  // both texts fully revealed — wait for user to press ENTER
}

export function registerPlayScene(_canvas, ctx) {
  registerScene('play', {
    enter() {
      resetRun();
      logExpanded = false;
      logAnim = 0;
      logScrollOffset = 0;
      logMaxScroll = 0;
      dossierExpanded = false;
      dossierAnim = 0;
      dossierScrollOffset = 0;
      dossierMaxScroll = 0;
      answerScrollOffset = 0;
      answerMaxScroll = 0;
      choiceScrollOffset = 0;
      choiceMaxScroll = 0;
      portraitSlide = 0;
      narrationSlide = 0;
      narrationTextProgress = 0;
      choicesAnim = 0;
      polygraphSlide = 0;
      laneFlash.heartRate = 0;
      laneFlash.eeg = 0;
      laneFlash.gsr = 0;
      prevMetrics.heartRate = state.metrics.heartRate;
      prevMetrics.eeg = state.metrics.eeg;
      prevMetrics.gsr = state.metrics.gsr;
      displayedNodeId = state.currentNodeId;
    },
    update(dt) {
      state.time += dt;
      updateWave(state, dt);
      tickFearAnimation(dt);
      updateMarkerCapture();

      portraitSlide = Math.min(1, portraitSlide + dt * PORTRAIT_SLIDE_SPEED);
      polygraphSlide = Math.min(1, polygraphSlide + dt * POLYGRAPH_SLIDE_SPEED);
      if (portraitSlide >= 0.7) {
        narrationSlide = Math.min(1, narrationSlide + dt * NARRATION_SLIDE_SPEED);
      }

      for (const key of ['heartRate', 'eeg', 'gsr']) {
        if (state.metrics[key] !== prevMetrics[key]) {
          prevMetrics[key] = state.metrics[key];
          laneFlash[key] = 1;
        }
        laneFlash[key] = Math.max(0, laneFlash[key] - dt * LANE_FLASH_DECAY);
      }

      if (state.currentNodeId !== displayedNodeId) {
        displayedNodeId = state.currentNodeId;
        narrationTextProgress = 0;
        choicesAnim = 0;
        answerScrollOffset = 0;
        answerMaxScroll = 0;
        choiceScrollOffset = 0;
        choiceMaxScroll = 0;
      }

      const totalTextLen = narrationTotalLen();
      if (narrationSlide >= 0.99 && narrationTextProgress < totalTextLen) {
        narrationTextProgress = Math.min(totalTextLen, narrationTextProgress + dt * NARRATION_CPS);
      }

      if (narrationTextProgress >= totalTextLen && !state.responseMode) {
        choicesAnim += dt * CHOICES_ANIM_SPEED;
      }

      updateLogHover(dt);
      updateDossierHover(dt);

      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }

      if (wasKeyPressed('r')) {
        resetRun();
        narrationTextProgress = 0;
        choicesAnim = 0;
        return;
      }

      if (!state.responseMode && narrationTextProgress < totalTextLen && wasKeyPressed('enter')) {
        narrationTextProgress = totalTextLen;
        return;
      }

      if (state.responseMode) {
        const wheel = getWheelDelta();
        if (wheel !== 0) {
          answerScrollOffset = clamp(answerScrollOffset + wheel / 30, 0, answerMaxScroll);
        }
        handleResponseMode(dt);
        return;
      }

      if (!state.responseMode && state.currentNode?.choices && !logExpanded && !dossierExpanded) {
        const wheel = getWheelDelta();
        if (wheel !== 0) {
          choiceScrollOffset = clamp(choiceScrollOffset + wheel / 30, 0, choiceMaxScroll);
        }
      }

      if (narrationTextProgress < totalTextLen) {
        return;
      }

      const choices = state.currentNode?.choices || [];
      for (let i = 0; i < Math.min(9, choices.length); i += 1) {
        if (wasKeyPressed(String(i + 1))) {
          pickChoice(i);
          return;
        }
      }

      if (wasMousePressed(0) && state.choiceRects.length > 0 && !logExpanded && !dossierExpanded) {
        const mouse = getMousePos();
        for (const rect of state.choiceRects) {
          if (inRect(mouse, rect)) {
            pickChoice(rect.index);
            return;
          }
        }
      }
    },
    render() {
      drawPlayScene(ctx);
    },
  });
}
