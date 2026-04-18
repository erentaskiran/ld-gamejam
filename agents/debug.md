# Debug Module

Source file: `js/debug.js`

## Responsibilities
- Toggle debug mode.
- Track FPS.
- Draw hitbox overlays.

## API Summary
- `toggleDebug()`: Toggles debug mode on/off.
- `isDebugEnabled()`: Returns whether debug mode is enabled.
- `updateDebug(dt)`: Updates internal FPS counters.
- `drawFPS(ctx)`: Draws the FPS panel.
- `drawHitbox(ctx, entity, color)`: Draws an entity hitbox.

## Notes
- `drawFPS` and `drawHitbox` render only when debug mode is enabled.
