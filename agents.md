# Agents Index

This file is the entry point for AI agents. Read only relevant docs instead of scanning the entire repo.

## Usage Flow

1. Read this file first.
2. Pick one focused module doc.
3. Read a second doc only if needed.
4. For full gameplay flow, read `agents/core-main-flow.md` last.

## Current App Shape (Quick)

- Engine helpers live in `js/*.js` (input, draw, loop, scene manager, audio, assets).
- Main game logic is scene-driven in `js/scenes/*.js`.
- Domain state/mechanics live in `js/game/*.js`.
- UI drawing components live in `js/ui/*.js`.
- Localization is in `js/i18n/*.js`.

## Module Index

- Input (keyboard, mouse, wheel, scroll invert): `agents/input.md`
- Rendering utilities (text wrap, sprites, scrollable text): `agents/rendering.md`
- Animation controllers: `agents/animations.md`
- Asset preloading and lookup: `agents/assets.md`
- Runtime audio + synth SFX: `agents/audio.md`
- Math helpers: `agents/math.md`
- Basic collision helpers (AABB / point): `agents/collision.md`
- Scene registry and fade transitions: `agents/scene-manager.md`
- Fixed timestep loop: `agents/game-loop.md`
- Timer utilities (available, currently not wired in scene flow): `agents/timer.md`
- Debug overlays (available, currently not wired in scene flow): `agents/debug.md`
- Tilemap collision helpers (available, currently not used by active scenes): `agents/tilemap.md`
- Object pool helper (utility module): `agents/pool.md`
- Legacy static game asset constants (not used by current scene flow): `agents/game-assets.md`
- Main boot + scene graph + gameplay flow: `agents/core-main-flow.md`

## Quick Task -> File

- "Title/menu/play/verdict behavior": `agents/core-main-flow.md`
- "Scene transition bug": `agents/scene-manager.md`
- "Case selection or verdict stats": `agents/core-main-flow.md`
- "Dialogue typing / choice click issue": `agents/core-main-flow.md`, `agents/input.md`
- "Canvas text/wrapping/scroll render issue": `agents/rendering.md`
- "Wheel / inverted scroll behavior": `agents/input.md`
- "Ambient interrogation sound behavior": `agents/audio.md`, `agents/core-main-flow.md`
- "Loading failure / missing assets": `agents/assets.md`, `agents/core-main-flow.md`
