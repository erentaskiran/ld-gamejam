# Input Module

Source file: `js/input.js`

## Responsibilities
- Track keyboard and mouse state.
- Store per-frame events (`pressed`/`released`).
- Convert mouse position to canvas coordinates with proper scaling.

## API Summary
- `initInput(canvas)`: Registers event listeners and runs once.
- `endFrameInput()`: Clears pressed/released sets.
- `isKeyDown(key)`: Whether a key is currently held.
- `wasKeyPressed(key)`: Whether a key was pressed this frame.
- `wasKeyReleased(key)`: Whether a key was released this frame.
- `isMouseDown(button)`: Whether a mouse button is currently held.
- `wasMousePressed(button)`: Whether a mouse button was pressed this frame.
- `wasMouseReleased(button)`: Whether a mouse button was released this frame.
- `getMousePos()`: Mouse position in canvas coordinates.

## Notes
- Keys are normalized to lowercase.
- `endFrameInput()` should be called at the end of every update tick.
