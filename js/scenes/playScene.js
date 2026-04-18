import { registerScene, setScene } from "../sceneManager.js";
import { getMousePos, wasKeyPressed, wasMousePressed } from "../input.js";
import { pickChoice, resetRun, setNode, state } from "../game/state.js";
import { updateWave } from "../game/waves.js";
import { drawSceneBackground } from "../ui/background.js";
import { drawNarrationBox } from "../ui/narrationBox.js";
import { drawPortraitBadge } from "../ui/portraitBadge.js";
import { drawPolygraph } from "../ui/polygraph.js";
import { drawChoiceModal } from "../ui/choiceModal.js";
import { drawDialogueModal } from "../ui/dialogueModal.js";
import { drawDialogLog } from "../ui/dialogLog.js";

const LAYOUT = {
  narration: { x: 8, y: 8, w: 518, h: 64 },
  operatorBadge: { x: 530, y: 4, w: 62, h: 72 },
  defendantBadge: { x: 8, y: 156, w: 62, h: 72 },
  modal: { x: 82, y: 80, w: 434, h: 148 },
  log: { x: 8, y: 234, w: 584, h: 60 },
  polygraph: { x: 0, y: 300, w: 600, h: 100 },
};

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function drawPlayScene(ctx) {
  drawSceneBackground(ctx);

  const node = state.currentNode;
  if (node) {
    drawNarrationBox(ctx, LAYOUT.narration.x, LAYOUT.narration.y, LAYOUT.narration.w, LAYOUT.narration.h, node.theme, node.description);
  }

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

  drawDialogLog(ctx, LAYOUT.log.x, LAYOUT.log.y, LAYOUT.log.w, LAYOUT.log.h, state.topLog);

  drawPolygraph(ctx, LAYOUT.polygraph.x, LAYOUT.polygraph.y, LAYOUT.polygraph.w, LAYOUT.polygraph.h, {
    waves: state.wave,
    time: state.time,
    metrics: state.metrics,
    fearBar: state.fearBar,
    maxFearBar: state.maxFearBar,
  });
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

export function registerPlayScene(_canvas, ctx) {
  registerScene("play", {
    enter() {
      resetRun();
    },
    update(dt) {
      state.time += dt;
      updateWave(state.wave, state.waveTarget, dt);

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

      if (wasMousePressed(0) && state.choiceRects.length > 0) {
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
