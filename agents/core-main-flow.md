# Core Main Flow

Source file: `js/main.js`

## Responsibilities
- Bootstraps the game startup flow.
- Holds global game state and entity objects.
- Registers scenes (`menu`, `play`) and wires update/render integration.
- Performs asset preload, map loading, and animation setup.

## High-Level Flow
1. Get canvas/context and initialize input.
2. Create player/enemy/goal entities and global `state`.
3. Define helper functions (spawn/goal/enemy lane/animation/background, etc.).
4. Register `menu` and `play` scenes.
5. Pass main `update` and `render` callbacks into the game loop.
6. In `boot()`, preload assets, load map, and build animation sets.
7. Switch to `menu` scene and start the loop.

## Module Connections
- Game loop: `js/gameLoop.js`
- Input: `js/input.js`
- Rendering: `js/draw.js`
- Assets/audio: `js/assets.js`, `js/audio.js`
- Scenes: `js/sceneManager.js`
- Animation: `js/animations.js`
- Collision/tilemap: `js/collision.js`, `js/tilemap.js`
- Timer/debug/math/config: `js/timer.js`, `js/debug.js`, `js/math.js`, `js/gameAssets.js`

## When To Read This File
- For gameplay flow, scoring behavior, scene transitions, or broad game behavior bugs.
