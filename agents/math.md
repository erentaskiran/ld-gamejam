# Math Module

Source file: `js/math.js`

## Responsibilities
- Provide common math helpers used by gameplay code.

## API Summary
- `clamp(value, min, max)`: Clamps a value to a range.
- `lerp(a, b, t)`: Linear interpolation.
- `dist(x1, y1, x2, y2)`: Distance between two points.
- `normalize(x, y)`: Converts a vector to a unit vector.

## Notes
- `normalize(0, 0)` returns `{ x: 0, y: 0 }`.
