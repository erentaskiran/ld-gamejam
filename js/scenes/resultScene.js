import { drawText, drawWrappedText } from "../draw.js";
import { registerScene, setScene } from "../sceneManager.js";
import { wasKeyPressed } from "../input.js";
import { state } from "../game/state.js";
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from "../ui/theme.js";
import { drawSceneBackground } from "../ui/background.js";
import { drawPanel } from "../ui/panel.js";

function drawResultScene(ctx) {
  drawSceneBackground(ctx);

  const endNode = state.currentNode;
  const success = state.currentNodeId.includes("success");
  const border = success ? COLORS.success : COLORS.fail;

  const panelX = 40;
  const panelY = 60;
  const panelW = DESIGN_W - 80;
  const panelH = DESIGN_H - 120;

  drawPanel(ctx, panelX, panelY, panelW, panelH, { border });

  drawText(ctx, `[ ${success ? "SONUC: BASARI" : "SONUC: BASARISIZ"} ]`, DESIGN_W / 2, panelY + 22, {
    align: "center",
    size: 16,
    color: success ? COLORS.success : COLORS.fail,
    font: UI_FONT,
    baseline: "middle",
  });

  if (endNode) {
    drawText(ctx, endNode.theme.toUpperCase(), DESIGN_W / 2, panelY + 56, {
      align: "center",
      size: 32,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: "middle",
    });
    drawWrappedText(ctx, endNode.description, DESIGN_W / 2, panelY + 84, panelW - 40, {
      size: 16,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 16,
      maxLines: 4,
      align: "center",
    });
    drawWrappedText(ctx, endNode.result_text, DESIGN_W / 2, panelY + 154, panelW - 40, {
      size: 16,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 16,
      maxLines: 4,
      align: "center",
    });
  }

  drawText(ctx, "R: Yeniden Oyna  |  ESC: Menu", DESIGN_W / 2, DESIGN_H - 28, {
    align: "center",
    size: 16,
    color: COLORS.cream,
    font: UI_FONT,
  });
}

function drawErrorScene(ctx) {
  drawSceneBackground(ctx);
  drawPanel(ctx, 60, 140, DESIGN_W - 120, 120, { border: COLORS.fail });
  drawText(ctx, "[ HATA ]", DESIGN_W / 2, 168, {
    align: "center",
    size: 24,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: "middle",
  });
  drawWrappedText(ctx, state.error, DESIGN_W / 2, 200, DESIGN_W - 160, {
    size: 16,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 16,
    maxLines: 4,
    align: "center",
  });
}

export function registerResultScene(_canvas, ctx) {
  registerScene("result", {
    update() {
      if (wasKeyPressed("r")) {
        setScene("play");
        return;
      }
      if (wasKeyPressed("escape")) {
        setScene("menu");
      }
    },
    render() {
      if (state.error) {
        drawErrorScene(ctx);
        return;
      }
      drawResultScene(ctx);
    },
  });
}
