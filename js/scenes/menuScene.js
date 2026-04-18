import { drawRect, drawText, drawWrappedText } from "../draw.js";
import { registerScene, setScene } from "../sceneManager.js";
import { getMousePos, wasKeyPressed, wasMousePressed } from "../input.js";
import { clamp } from "../math.js";
import { CASES } from "../game/cases.js";
import { getSelectedCaseData, setSelectedCase, state } from "../game/state.js";
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from "../ui/theme.js";
import { drawSceneBackground } from "../ui/background.js";
import { drawPanel } from "../ui/panel.js";

let menuAnim = 0;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function parseLabel(label) {
  const dashIdx = label.indexOf(" - ");
  if (dashIdx < 0) {
    return { prefix: label, suffix: "" };
  }
  return {
    prefix: label.slice(0, dashIdx),
    suffix: label.slice(dashIdx + 3),
  };
}

function drawCaseCard(ctx, x, y, w, h, opts) {
  const { number, prefix, suffix, selected, hovered, pulseT } = opts;
  const borderColor = selected ? COLORS.amberBright : hovered ? COLORS.amber : COLORS.amberDim;
  const fillColor = selected
    ? "rgba(60, 36, 14, 0.8)"
    : hovered
      ? "rgba(30, 20, 10, 0.65)"
      : COLORS.panelFillLight;

  drawPanel(ctx, x, y, w, h, { border: borderColor, fill: fillColor });

  drawText(ctx, number, x + 14, y + h / 2, {
    size: 22,
    color: selected ? COLORS.amberBright : COLORS.amber,
    font: UI_FONT,
    baseline: "middle",
  });

  drawRect(ctx, x + 42, y + 8, 1, h - 16, COLORS.amberDim);

  drawText(ctx, prefix, x + 50, y + 16, {
    size: 12,
    color: selected ? COLORS.amberBright : COLORS.cream,
    font: UI_FONT,
    baseline: "middle",
  });

  drawWrappedText(ctx, suffix, x + 50, y + 32, w - 60, {
    size: 12,
    color: COLORS.creamDim,
    font: UI_FONT,
    lineHeight: 12,
    maxLines: 2,
  });

  if (selected) {
    const pulse = 0.5 + 0.5 * Math.sin(pulseT * 3);
    ctx.save();
    ctx.globalAlpha = 0.25 + pulse * 0.55;
    drawRect(ctx, x + 2, y + 2, w - 4, 1, COLORS.amberBright);
    drawRect(ctx, x + 2, y + h - 3, w - 4, 1, COLORS.amberBright);
    ctx.restore();
  }
}

function drawMenuScene(ctx) {
  drawSceneBackground(ctx);

  const panelX = 20;
  const panelY = 20;
  const panelW = DESIGN_W - 40;
  const panelH = DESIGN_H - 40;
  drawPanel(ctx, panelX, panelY, panelW, panelH, { border: COLORS.amber });

  const titleP = smoothstep(clamp(menuAnim / 0.4, 0, 1));
  if (titleP > 0.01) {
    const titleY = -28 + (52 - -28) * titleP;
    ctx.save();
    ctx.globalAlpha = titleP;
    drawText(ctx, "THE OPERATOR", DESIGN_W / 2, titleY, {
      align: "center",
      size: 28,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: "middle",
    });
    ctx.restore();
  }

  const subtitleP = smoothstep(clamp((menuAnim - 0.3) / 0.3, 0, 1));
  if (subtitleP > 0.01) {
    ctx.save();
    ctx.globalAlpha = subtitleP;
    drawText(ctx, "[ CASE SECIMI ]", DESIGN_W / 2, 78, {
      align: "center",
      size: 12,
      color: COLORS.cream,
      font: UI_FONT,
      baseline: "middle",
    });
    ctx.restore();
  }

  state.menuCaseRects = [];
  const cardW = 236;
  const cardH = 56;
  const cardGap = 16;
  const cardsTotalW = cardW * CASES.length + cardGap * (CASES.length - 1);
  const startX = (DESIGN_W - cardsTotalW) / 2;
  const cardY = 100;
  const mouse = getMousePos();

  for (let i = 0; i < CASES.length; i += 1) {
    const x = startX + i * (cardW + cardGap);
    const rect = { x, y: cardY, w: cardW, h: cardH, index: i };
    state.menuCaseRects.push(rect);

    const cardStart = 0.5 + i * 0.15;
    const cardP = smoothstep(clamp((menuAnim - cardStart) / 0.4, 0, 1));
    if (cardP < 0.01) {
      continue;
    }

    const yOffset = (1 - cardP) * 18;
    const selected = i === state.caseIndex;
    const interactive = cardP > 0.6;
    const hovered = interactive && inRect(mouse, rect);

    const { prefix, suffix } = parseLabel(CASES[i].label);
    const numberStr = String(i + 1).padStart(2, "0");

    ctx.save();
    ctx.globalAlpha = cardP;
    drawCaseCard(ctx, x, cardY + yOffset, cardW, cardH, {
      number: numberStr,
      prefix,
      suffix,
      selected,
      hovered,
      pulseT: menuAnim,
    });
    ctx.restore();
  }

  const infoP = smoothstep(clamp((menuAnim - 0.85) / 0.4, 0, 1));
  if (infoP > 0.01) {
    const caseData = getSelectedCaseData();
    const infoX = 48;
    const infoBaseY = 176;
    const infoYOffset = (1 - infoP) * 14;
    const infoY = infoBaseY + infoYOffset;
    const infoW = DESIGN_W - 96;
    const infoH = 168;

    ctx.save();
    ctx.globalAlpha = infoP;
    drawPanel(ctx, infoX, infoY, infoW, infoH, { border: COLORS.amberDim });

    if (caseData) {
      drawText(ctx, caseData.title, DESIGN_W / 2, infoY + 14, {
        align: "center",
        size: 12,
        color: COLORS.amberBright,
        font: UI_FONT,
        baseline: "middle",
      });
      drawWrappedText(ctx, caseData.context, infoX + 12, infoY + 34, infoW - 24, {
        size: 12,
        color: COLORS.cream,
        font: UI_FONT,
        lineHeight: 12,
        maxLines: 9,
      });
    } else {
      drawText(ctx, "Vaka yuklenemedi.", DESIGN_W / 2, infoY + infoH / 2, {
        align: "center",
        size: 12,
        color: COLORS.fail,
        font: UI_FONT,
        baseline: "middle",
      });
    }

    ctx.restore();
  }

  const promptP = smoothstep(clamp((menuAnim - 1.2) / 0.3, 0, 1));
  if (promptP > 0.01) {
    ctx.save();
    ctx.globalAlpha = promptP;
    drawText(ctx, "1-2 / OK TUSLARI: VAKA SEC", DESIGN_W / 2, DESIGN_H - 44, {
      align: "center",
      size: 12,
      color: COLORS.creamDim,
      font: UI_FONT,
      baseline: "middle",
    });
    ctx.restore();

    const blink = 0.45 + 0.55 * Math.abs(Math.sin(menuAnim * 2.6));
    ctx.save();
    ctx.globalAlpha = promptP * blink;
    drawText(ctx, ">> ENTER: BASLA <<", DESIGN_W / 2, DESIGN_H - 28, {
      align: "center",
      size: 12,
      color: COLORS.amberBright,
      font: UI_FONT,
      baseline: "middle",
    });
    ctx.restore();
  }
}

export function registerMenuScene(_canvas, ctx) {
  registerScene("menu", {
    enter() {
      menuAnim = 0;
    },
    update(dt) {
      menuAnim += dt;

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
