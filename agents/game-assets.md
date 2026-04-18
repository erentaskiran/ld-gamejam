# Game Assets Config Module

Source file: `js/gameAssets.js`

## Responsibilities
- Define asset path/key configuration.
- Provide default tile rendering and tileset metadata.
- Store animation frame constants for player/enemy/environment/decor.
- Define map parsing configuration.

## Main Constants
- `ASSETS`: Image/audio list for preloading.
- `MAP_TILESET_KEY`, `ACTOR_TILESET_KEY`: Asset key names.
- `TILE_RENDER`, `TILESET_META`: Tile rendering and frame metadata.
- `MAP_CONFIG`, `MAP_PARSE_CONFIG`: Map path and parse options.
- `PLAYER_ANIMATIONS`, `ENEMY_ANIMATIONS`, `DECOR_FRAMES`, `GOAL_SPRITE_FRAME`, `ENVIRONMENT_ANIMATIONS`.

## Notes
- This file is primarily static config/constants rather than runtime logic.
