import { registerScene, setScene } from "../sceneManager.js";
import { getMousePos, getWheelDelta, wasKeyPressed, wasMousePressed } from "../input.js";
import { clamp } from "../math.js";
import { pickChoice, resetRun, setNode, state } from "../game/state.js";
import { updateWave } from "../game/waves.js";
import { drawSceneBackground } from "../ui/background.js";
import { drawNarrationBox } from "../ui/narrationBox.js";
import { drawPortraitBadge } from "../ui/portraitBadge.js";
import { drawPolygraph } from "../ui/polygraph.js";
import { drawChoiceModal } from "../ui/choiceModal.js";
import { drawDialogueModal } from "../ui/dialogueModal.js";
import { drawLogPanel, drawLogTab } from "../ui/dialogLog.js";

const LAYOUT = {
  narration: { x: 8, y: 8, w: 518, h: 64 },
  operatorBadge: { x: 530, y: 4, w: 62, h: 72 },
  defendantBadge: { x: 8, y: 156, w: 62, h: 72 },
  modal: { x: 82, y: 80, w: 434, h: 148 },
  logTab: { x: 530, y: 80, w: 62, h: 20 },
  logPanel: { x: 260, y: 80, w: 332, h: 210 },
  polygraph: { x: 0, y: 236, w: 600, h: 164 },
};

let logExpanded = false;
let logScrollOffset = 0;
let logMaxScroll = 0;

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function drawConversationPortraits(ctx) {
  drawPortraitBadge(
    ctx,
    LAYOUT.operatorBadge.x,
    LAYOUT.operatorBadge.y,
    LAYOUT.operatorBadge.w,
    LAYOUT.operatorBadge.h,
    "operator",
    "OPERATOR",
  );

  drawPortraitBadge(
    ctx,
    LAYOUT.defendantBadge.x,
    LAYOUT.defendantBadge.y,
    LAYOUT.defendantBadge.w,
    LAYOUT.defendantBadge.h,
    "defendant",
    state.gameData?.suspect?.role ? "OZAN" : "DEFENDANT",
  );
}

function drawPlayScene(ctx) {
  drawSceneBackground(ctx);

  const node = state.currentNode;
  if (node) {
    drawNarrationBox(ctx, LAYOUT.narration.x, LAYOUT.narration.y, LAYOUT.narration.w, LAYOUT.narration.h, node.theme, node.description);
  }

  drawConversationPortraits(ctx);

  if (state.responseMode && (state.lastQuestion || state.lastAnswer)) {
    drawDialogueModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      question: state.lastQuestion,
      answer: state.lastAnswer,
    });
    state.choiceRects = [];
  } else if (node && node.choices && !node.is_end_state) {
    state.choiceRects = drawChoiceModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      choices: node.choices,
    });
  } else {
    state.choiceRects = [];
  }

  drawPolygraph(ctx, LAYOUT.polygraph.x, LAYOUT.polygraph.y, LAYOUT.polygraph.w, LAYOUT.polygraph.h, {
    waves: state.wave,
    time: state.time,
    metrics: state.metrics,
    fearBar: state.fearBar,
    maxFearBar: state.maxFearBar,
  });

  if (logExpanded) {
    const result = drawLogPanel(
      ctx,
      LAYOUT.logPanel.x,
      LAYOUT.logPanel.y,
      LAYOUT.logPanel.w,
      LAYOUT.logPanel.h,
      state.topLog,
      logScrollOffset,
    );
    logMaxScroll = result.maxScroll;
    logScrollOffset = result.clampedScroll;
  } else {
    drawLogTab(ctx, LAYOUT.logTab.x, LAYOUT.logTab.y, LAYOUT.logTab.w, LAYOUT.logTab.h, state.topLog.length);
  }
}

function advanceToPendingNode() {
  if (!state.pendingNodeId) {
    return;
  }
  const result = setNode(state.pendingNodeId);
  if (!result.ok || result.isEnd) {
    setScene("result");
  }
}

function updateLogHover() {
  const mouse = getMousePos();
  const rect = logExpanded ? LAYOUT.logPanel : LAYOUT.logTab;
  const hovering = inRect(mouse, rect);

  if (!hovering && logExpanded) {
    logExpanded = false;
    logScrollOffset = 0;
  } else if (hovering && !logExpanded) {
    logExpanded = true;
  }

  if (logExpanded) {
    const wheel = getWheelDelta();
    if (wheel !== 0) {
      logScrollOffset = clamp(logScrollOffset - wheel / 30, 0, logMaxScroll);
    }
  }
}

export function registerPlayScene(_canvas, ctx) {
  registerScene("play", {
    enter() {
      resetRun();
      logExpanded = false;
      logScrollOffset = 0;
      logMaxScroll = 0;
    },
    update(dt) {
      state.time += dt;
      updateWave(state.wave, state.waveTarget, dt);

      updateLogHover();

      if (wasKeyPressed("escape")) {
        setScene("menu");
        return;
      }

      if (wasKeyPressed("r")) {
        resetRun();
        return;
      }

      if (state.responseMode) {
        if (wasKeyPressed("enter")) {
          state.responseTimer = 0;
        } else {
          state.responseTimer -= dt;
        }

        if (state.responseTimer <= 0) {
          advanceToPendingNode();
        }
        return;
      }

      const choices = state.currentNode?.choices || [];
      for (let i = 0; i < Math.min(9, choices.length); i += 1) {
        if (wasKeyPressed(String(i + 1))) {
          pickChoice(i);
          return;
        }
      }

      if (wasMousePressed(0) && state.choiceRects.length > 0 && !logExpanded) {
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
