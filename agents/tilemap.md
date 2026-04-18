# Tilemap Module

Source file: `js/tilemap.js`

## Responsibilities
- Convert tile IDs to sprite frames.
- Load and normalize tilemap JSON data.
- Build collision grid and provide tile-based collision checks.
- Extract spawn points from map layers.

## API Summary
- `tileIdToFrame(id, tilesetMeta)`: Converts tile ID to frame coordinates.
- `isBlockedAtWorldPos(x, y, mapData)`: Checks whether world position is blocked.
- `isRectBlocked(rect, mapData)`: Checks whether any rect corner is blocked.
- `moveWithCollisions(entity, dx, dy, mapData)`: Resolves movement with axis-separated collision.
- `loadTilemap(path, options)`: Loads map JSON and appends `collisionGrid` and `spawns`.

## Notes
- Positions outside the map are treated as blocked.
- `options.colliderTileIds` and spawn settings affect parse behavior.
