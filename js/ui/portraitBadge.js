import { getImage } from "../assets.js";
import { drawRect, drawText } from "../draw.js";
import { COLORS, UI_FONT } from "./theme.js";
import { drawPanel } from "./panel.js";

export function drawPortraitBadge(ctx, x, y, w, h, imageKey, label) {
  drawPanel(ctx, x, y, w, h, { border: COLORS.amber });

  const labelH = 16;
  const portraitX = x + 3;
  const portraitY = y + 3;
  const portraitW = w - 6;
  const portraitH = h - labelH - 4;

  const img = getImage(imageKey);
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(portraitX, portraitY, portraitW, portraitH);
    ctx.clip();
    const scale = Math.max(portraitW / img.width, portraitH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const offsetX = portraitX + (portraitW - drawW) / 2;
    const offsetY = portraitY + (portraitH - drawH) / 2;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();
  } else {
    drawRect(ctx, portraitX, portraitY, portraitW, portraitH, COLORS.panelSolid);
  }

  drawRect(ctx, x + 1, y + h - labelH - 1, w - 2, 1, COLORS.amberDim);

  drawText(ctx, label, x + w / 2, y + h - labelH / 2, {
    size: 16,
    color: COLORS.cream,
    align: "center",
    font: UI_FONT,
    baseline: "middle",
  });
}
