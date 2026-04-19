# Core Main Flow

Source file: `js/main.js`

## Responsibilities

- Bootstraps canvas, input, scene graph, and game loop.
- Handles responsive canvas scaling from design resolution to viewport.
- Loads fonts, images, and case JSON data before entering gameplay.
- Delegates gameplay to scene modules and applies global scanline/post-transition overlay.

## High-Level Flow

1. Initialize canvas/context; set design scale (`DESIGN_W`, `DESIGN_H`) and resize handler.
2. Initialize input once with canvas and per-frame input flushing in `update()`.
3. Register all scenes: `title`, `settings`, `menu`, `dossier`, `play`, `verdict`, `result`.
4. Create loop via `createGameLoop({ update, render })`.
5. `boot()` shows loading text, then runs `Promise.all([loadAllCases(), preloadAssets(...), loadCustomFonts()])`.
6. Save case data to shared state, select default case, clear loading flag.
7. Enter `title` scene and start loop.

## Module Connections

- Scene manager + transitions: `js/sceneManager.js`
- Scenes (`js/scenes/*.js`):
  - `title` -> splash/entry
  - `menu` -> case select
  - `settings` -> language + scroll inversion
  - `dossier` -> case briefing
  - `play` -> interrogation runtime
  - `verdict` -> evidence review + verdict choice
  - `result` -> final outcome
- Game domain:
  - `js/game/state.js` central mutable session state
  - `js/game/cases.js` case definitions + loading
  - `js/game/waves.js` biometric simulation + draw data
  - `js/game/caseStats.js` persisted attempts/success stats
- UI modules: `js/ui/*.js` provide all major panel/modal drawing blocks.
- Localization: `js/i18n/*.js` (`t()`, language persistence).
- Ambient audio control: `js/interrogationAudio.js` (scene + dialogue driven).

## When To Read This File

- For end-to-end gameplay flow issues, state handoff between scenes, or boot/load failures.
- For debugging interactions that span scenes (input, audio profile shifts, verdict/result flow).
