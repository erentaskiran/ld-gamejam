import { drawText, drawWrappedText } from "../draw.js";
import { registerScene, setScene } from "../sceneManager.js";
import { getMousePos, wasKeyPressed, wasMousePressed } from "../input.js";
import { CASES } from "../game/cases.js";
import { getSelectedCaseData, setSelectedCase, state } from "../game/state.js";
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from "../ui/theme.js";
import { drawSceneBackground } from "../ui/background.js";
import { drawPanel } from "../ui/panel.js";

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function drawMenuScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 20;
  const panelY = 20;
  const panelW = DESIGN_W - 40;
  const panelH = DESIGN_H - 40;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  drawText(ctx, "THE OPERATOR", DESIGN_W / 2, 60, {
    align: "center",
    size: 40,
    color: COLORS.amberBright,
    font: UI_FONT,
  });
  drawText(ctx, "[ CASE SECIMI ]", DESIGN_W / 2, 88, {
    align: "center",
    size: 16,
    color: COLORS.cream,
    font: UI_FONT,
  });

  state.menuCaseRects = [];
  const cardW = 260;
  const cardH = 40;
  const gap = 16;
  const cardsTotalW = cardW * CASES.length + gap * (CASES.length - 1);
  const startX = (DESIGN_W - cardsTotalW) / 2;
  const cardY = 108;

  for (let i = 0; i < CASES.length; i += 1) {
    const x = startX + i * (cardW + gap);
    const selected = i === state.caseIndex;
    drawPanel(ctx, x, cardY, cardW, cardH, {
      border: selected ? COLORS.amberBright : COLORS.amberDim,
      fill: selected ? "rgba(60, 36, 14, 0.7)" : COLORS.panelFillLight,
    });
    drawText(ctx, `${i + 1}. ${CASES[i].label}`, x + 10, cardY + cardH / 2, {
      size: 16,
      color: selected ? COLORS.amberBright : COLORS.cream,
      font: UI_FONT,
      baseline: "middle",
    });
    state.menuCaseRects.push({ x, y: cardY, w: cardW, h: cardH, index: i });
  }

  const caseData = getSelectedCaseData();
  const infoX = 48;
  const infoY = 170;
  const infoW = DESIGN_W - 96;
  const infoH = 150;
  drawPanel(ctx, infoX, infoY, infoW, infoH, { border: COLORS.amberDim });

  if (caseData) {
    drawText(ctx, caseData.title, DESIGN_W / 2, infoY + 20, {
      align: "center",
      size: 16,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: "middle",
    });
    drawWrappedText(ctx, caseData.context, infoX + 12, infoY + 42, infoW - 24, {
      size: 16,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 16,
      maxLines: 6,
    });
  } else {
    drawText(ctx, "Vaka yuklenemedi.", DESIGN_W / 2, infoY + infoH / 2, {
      align: "center",
      size: 16,
      color: COLORS.fail,
      font: UI_FONT,
      baseline: "middle",
    });
  }

  drawText(ctx, "1-2: Vaka sec  |  ENTER: Basla", DESIGN_W / 2, DESIGN_H - 32, {
    align: "center",
    size: 16,
    color: COLORS.creamDim,
    font: UI_FONT,
  });
}

export function registerMenuScene(_canvas, ctx) {
  registerScene("menu", {
    update() {
      if (wasKeyPressed("1")) {
        setSelectedCase(0);
      }
      if (wasKeyPressed("2")) {
        setSelectedCase(1);
      }
      if (wasKeyPressed("arrowleft") || wasKeyPressed("arrowup") || wasKeyPressed("a") || wasKeyPressed("w")) {
        setSelectedCase(state.caseIndex - 1);
      }
      if (wasKeyPressed("arrowright") || wasKeyPressed("arrowdown") || wasKeyPressed("d") || wasKeyPressed("s")) {
        setSelectedCase(state.caseIndex + 1);
      }

      if (wasMousePressed(0) && state.menuCaseRects.length > 0) {
        const mouse = getMousePos();
        for (const rect of state.menuCaseRects) {
          if (inRect(mouse, rect)) {
            setSelectedCase(rect.index);
            break;
          }
        }
      }

      if (wasKeyPressed("enter") && state.gameData) {
        setScene("play");
      }
    },
    render() {
      drawMenuScene(ctx);
    },
  });
}
