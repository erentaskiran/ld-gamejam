# Collision Module

Source file: `js/collision.js`

## Responsibilities
- Provide simple collision checks (AABB and point-rectangle).

## API Summary
- `aabbIntersect(a, b)`: Whether two axis-aligned rectangles overlap.
- `pointInRect(point, rect)`: Whether a point is inside a rectangle.

## Notes
- Coordinates are expected in screen/world space used by the game.
