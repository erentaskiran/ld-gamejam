import { createGameLoop } from "./gameLoop.js";
import { endFrameInput, initInput, setDesignScale } from "./input.js";
import { preloadAssets } from "./assets.js";
import { clearCanvas, drawText } from "./draw.js";
import { getTransitionAlpha, renderScene, setScene, updateScene } from "./sceneManager.js";
import { loadAllCases } from "./game/cases.js";
import { setSelectedCase, state } from "./game/state.js";
import { registerMenuScene } from "./scenes/menuScene.js";
import { registerPlayScene } from "./scenes/playScene.js";
import { registerResultScene } from "./scenes/resultScene.js";
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from "./ui/theme.js";

async function loadCustomFonts() {
  const font = new FontFace("m5x7", "url(./assets/m5x7.ttf)");
  await font.load();
  document.fonts.add(font);
}

const canvas = document.getElementById("game");
const ctx = canvas ? canvas.getContext("2d") : null;

if (!canvas || !ctx) {
  throw new Error("Canvas could not be initialized.");
}

let renderScale = 1;

function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspect = DESIGN_W / DESIGN_H;
  let w;
  let h;
  if (vw / vh > aspect) {
    h = vh;
    w = Math.round(vh * aspect);
  } else {
    w = vw;
    h = Math.round(vw / aspect);
  }
  canvas.width = w;
  canvas.height = h;
  renderScale = w / DESIGN_W;
  ctx.imageSmoothingEnabled = false;
  setDesignScale(renderScale);
}

initInput(canvas);
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

registerMenuScene(canvas, ctx);
registerPlayScene(canvas, ctx);
registerResultScene(canvas, ctx);

function update(dt) {
  updateScene(dt);
  endFrameInput();
}

function render() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  renderScene();

  const alpha = getTransitionAlpha();
  if (alpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }
}

const loop = createGameLoop({ update, render });

async function boot() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  clearCanvas(ctx, COLORS.ink);
  drawText(ctx, "Yukleniyor...", DESIGN_W / 2, DESIGN_H / 2, {
    align: "center",
    size: 24,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: "middle",
  });

  const [caseDataById] = await Promise.all([
    loadAllCases(),
    preloadAssets({
      images: {
        background: "./assets/background.png",
        operator: "./assets/operator.png",
        defendant: "./assets/defendant.png",
      },
    }),
    loadCustomFonts(),
  ]);

  state.caseDataById = caseDataById;
  setSelectedCase(0);
  state.loading = false;

  setScene("menu");
  loop.start();
}

boot().catch((error) => {
  state.error = error.message;
  state.loading = false;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  clearCanvas(ctx, "#1a0b10");
  drawText(ctx, "Oyun baslatilamadi", DESIGN_W / 2, DESIGN_H / 2 - 14, {
    align: "center",
    size: 24,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: "middle",
  });
  drawText(ctx, error.message, DESIGN_W / 2, DESIGN_H / 2 + 16, {
    align: "center",
    size: 16,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: "middle",
  });
  throw error;
});
