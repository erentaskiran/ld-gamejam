# Rendering Module

Source file: `js/draw.js`

## Responsibilities
- Clear canvas, draw rectangles, and render text.
- Draw full sprites and sprite-sheet frames.
- Support horizontal flipping.

## API Summary
- `clearCanvas(ctx, color)`: Fills the canvas with a single color.
- `drawRect(ctx, x, y, w, h, color)`: Draws a rectangle.
- `drawSprite(ctx, img, x, y, w, h, flipX)`: Draws a full image.
- `drawSpriteFrame(ctx, img, frame, x, y, w, h, flipX, options)`: Draws one frame from a sprite sheet.
- `drawText(ctx, text, x, y, options)`: Draws text with font/color/alignment options.

## Notes
- `options.sourceInset` in `drawSpriteFrame` can reduce texture bleeding artifacts.
- Drawing is skipped safely if image or frame is missing.
