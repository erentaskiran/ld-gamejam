# Agents Index

This file is the entry point for AI agents. Goal: read only the relevant file instead of scanning the entire codebase.

## Usage Flow

1. Read this file first.
2. Pick one module that matches the task.
3. Read a second module only if needed.
4. If full app flow is required, read `agents/core-main-flow.md` last.

## Module Index

- Input / keyboard / mouse: `agents/input.md`
- Rendering helpers (canvas): `agents/rendering.md`
- Animation systems: `agents/animations.md`
- Asset loading (image/audio): `agents/assets.md`
- Audio / music playback: `agents/audio.md`
- Math helpers: `agents/math.md`
- Collision (AABB / point): `agents/collision.md`
- Scene management: `agents/scene-manager.md`
- Game loop (fixed timestep): `agents/game-loop.md`
- Timer / cooldown: `agents/timer.md`
- Debug helpers: `agents/debug.md`
- Tilemap and tile collision: `agents/tilemap.md`
- Object pool: `agents/pool.md`
- Game asset config (asset keys, animation frames): `agents/game-assets.md`
- Core flow (main.js): `agents/core-main-flow.md`

## Quick Task -> File

- "Input bug": `agents/input.md`
- "FPS / loop issue": `agents/game-loop.md`, then `agents/debug.md` if needed
- "Scene transition": `agents/scene-manager.md`
- "Sprite not rendering": `agents/rendering.md`, `agents/assets.md`
- "Animation not playing": `agents/animations.md`
- "Map collision is wrong": `agents/tilemap.md`, `agents/collision.md`
- "Score / player behavior": `agents/core-main-flow.md`
