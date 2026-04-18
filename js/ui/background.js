import { getImage } from "../assets.js";
import { drawRect } from "../draw.js";
import { COLORS, DESIGN_H, DESIGN_W } from "./theme.js";

export function drawSceneBackground(ctx, imageKey = "background") {
  drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, COLORS.ink);
  const img = getImage(imageKey);
  if (img) {
    ctx.drawImage(img, 0, 0, DESIGN_W, DESIGN_H);
    drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, "rgba(8, 5, 3, 0.25)");
  }
}
