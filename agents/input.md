# Input Module

Source file: `js/input.js`

## Responsibilities

- Track keyboard state (`down`, `pressed this frame`, `released this frame`).
- Track mouse buttons and canvas-relative mouse position.
- Accumulate wheel delta per frame and expose platform scroll helpers.
- Persist and apply scroll inversion preference via `localStorage`.

## API Summary

- `initInput(canvas)`: One-time event listener setup for keyboard, mouse, wheel, context-menu block.
- `setDesignScale(scale)`: Converts real canvas mouse coordinates into design-space coordinates.
- `endFrameInput()`: Clears one-frame sets and resets wheel delta.
- `getWheelDelta()`: Raw accumulated wheel delta for current frame.
- `getPlatformScrollDelta()`: Wheel delta with inversion preference applied.
- `isScrollInverted()`, `setScrollInverted(next)`, `toggleScrollInverted()`: Scroll preference API.
- `isKeyDown(key)`, `wasKeyPressed(key)`, `wasAnyKeyPressed()`, `wasKeyReleased(key)`: Keyboard queries.
- `isMouseDown(button)`, `wasMousePressed(button)`, `wasMouseReleased(button)`: Mouse button queries.
- `getMousePos()`: `{ x, y }` in design-space coordinates.

## Notes

- Keys are normalized to lowercase.
- `endFrameInput()` is expected at the end of each fixed update tick (`main.js`).
- Wheel listener uses `passive: false` and `preventDefault()` to keep scene-driven scrolling consistent.
