export function clearCanvas(ctx, color = "#0b1224") {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawRect(ctx, x, y, w, h, color = "#ffffff") {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawSprite(ctx, img, x, y, w, h, flipX = false) {
  if (!img) {
    return;
  }

  ctx.save();
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

export function drawSpriteFrame(ctx, img, frame, x, y, w, h, flipX = false, options = {}) {
  if (!img || !frame) {
    return;
  }

  const sourceInset = options.sourceInset ?? 0;
  const sx = frame.x + sourceInset;
  const sy = frame.y + sourceInset;
  const sw = frame.w - sourceInset * 2;
  const sh = frame.h - sourceInset * 2;

  if (sw <= 0 || sh <= 0) {
    return;
  }

  const drawW = w ?? frame.w;
  const drawH = h ?? frame.h;

  ctx.save();
  if (flipX) {
    ctx.translate(x + drawW, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawW, drawH);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, x, y, drawW, drawH);
  }
  ctx.restore();
}

export function drawText(ctx, text, x, y, options = {}) {
  const {
    color = "#e5e7eb",
    size = 18,
    font = "Trebuchet MS, Segoe UI, sans-serif",
    align = "left",
    baseline = "alphabetic",
  } = options;

  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}
