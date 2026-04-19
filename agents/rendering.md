# Rendering Module

Source file: `js/draw.js`

## Responsibilities

- Provide shared canvas draw primitives for all scenes/UI.
- Render text, wrapped text, and scrollable text blocks.
- Render full sprites and sprite-sheet frames with optional horizontal flip.

## API Summary

- `clearCanvas(ctx, color)`: Fill entire canvas.
- `drawRect(ctx, x, y, w, h, color)`: Solid rectangle helper.
- `drawSprite(ctx, img, x, y, w, h, flipX)`: Draw full image (optional mirror).
- `drawSpriteFrame(ctx, img, frame, x, y, w, h, flipX, options)`: Draw sprite atlas sub-rect.
- `drawText(ctx, text, x, y, options)`: Text helper with `size/font/color/align/baseline`.
- `wrapTextLines(ctx, text, maxWidth, size, font)`: Returns wrapped line array.
- `drawWrappedText(ctx, text, x, y, maxWidth, options)`: Draw wrapped lines; returns drawn line count.
- `drawScrollableText(ctx, text, x, y, w, h, scrollOffset, options)`: Draw clipped text viewport + scrollbar; returns `{ clampedScroll, maxScroll }`.

## Notes

- `drawSpriteFrame` supports `options.sourceInset` to avoid sprite bleeding.
- All sprite helpers safely no-op when image/frame is missing.
- `drawScrollableText` is used by menu/dialog-style panels where content exceeds viewport height.
