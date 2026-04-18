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

  drawText(ctx, `[ ${success ? "SONUC: BASARI" : "SONUC: BASARISIZ"} ]`, DESIGN_W / 2, panelY + 16, {
    align: "center",
    size: 12,
    color: success ? COLORS.success : COLORS.fail,
    font: UI_FONT,
    baseline: "middle",
  });

  if (endNode) {
    drawText(ctx, endNode.theme.toUpperCase(), DESIGN_W / 2, panelY + 44, {
      align: "center",
      size: 22,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: "middle",
    });
    drawWrappedText(ctx, endNode.description, DESIGN_W / 2, panelY + 72, panelW - 40, {
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 4,
      align: "center",
    });
    drawWrappedText(ctx, endNode.result_text, DESIGN_W / 2, panelY + 134, panelW - 40, {
      size: 12,
      color: COLORS.creamDim,
      font: UI_FONT,
      lineHeight: 12,
      maxLines: 4,
      align: "center",
    });
  }

  drawText(ctx, "R: Yeniden Oyna  |  ESC: Menu", DESIGN_W / 2, DESIGN_H - 22, {
    align: "center",
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
  });
}

function drawErrorScene(ctx) {
  drawSceneBackground(ctx);
  drawPanel(ctx, 60, 140, DESIGN_W - 120, 120, { border: COLORS.fail });
  drawText(ctx, "[ HATA ]", DESIGN_W / 2, 164, {
    align: "center",
    size: 18,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: "middle",
  });
  drawWrappedText(ctx, state.error, DESIGN_W / 2, 196, DESIGN_W - 160, {
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 12,
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
