<img width="1024" height="711" alt="cover-image" src="https://github.com/user-attachments/assets/a56dcb49-3385-4fcd-a0dd-7f14cb3a3c62" />

# The Operator

**You don't catch liars. You read them.**

A pixel-art interrogation game. A lamp-lit room, a polygraph, and a suspect with a rehearsed story. You are the Operator — you pick every question, watch three raw biosignals climb and fall, and call the verdict.

---

## Table of contents

- [What it is](#what-it-is)
- [Gameplay](#gameplay)
- [Running locally](#running-locally)
- [Project layout](#project-layout)
- [Scene flow](#scene-flow)
- [Case data format](#case-data-format)
- [Authoring new cases](#authoring-new-cases)
- [Scripts](#scripts)
- [Tech notes](#tech-notes)
- [Tooling](#tooling)

---

## What it is

The Operator puts you in a polygraph booth. Every case is a civil suit: a pharmacist accused of diluting chemo batches, a coach accused of fixing matches, a contractor accused of cutting corners on a collapsed building. The lawyers have signed off. The suspect is in the chair. The verdict is yours.

- Three raw signals: **pulse**, **breath**, **skin (GSR)**. No labels, no hints. A spike can mean guilt, caffeine, an SSRI, or nothing — you infer from the dossier.
- Branching dialogue with tactical choices: Empathic, Aggressive, Trap, Evidence, Moral Pressure, Legal Threat.
- Two languages out of the box: English and Turkish.
- Fully browser-based. No backend. Canvas-rendered pixel art at 600×400 design resolution, scaled to fit.

## Gameplay

1. **Title → Menu** — pick a case.
2. **Briefing** — read the accusation and the theory of the case.
3. **Dossier** — study the suspect's background and pressure points.
4. **Interrogation** — ask questions. Each choice has a tactic and a target effect. Biosignals react in real time; a hidden stress meter (`korku_bari`) shifts with every answer.
5. **Verdict** — call guilty or not guilty. The true outcome is revealed after your call.

Read the baseline wrong and the whole session is poisoned. Use the wrong tactic at the wrong moment and the suspect hardens, lawyers up, and the window closes.

## Running locally

The game is a static site — no build step, no bundler. Any static server will do:

```sh
# from the project root
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly via `file://` will fail because the game loads case JSON via `fetch`.

Install dependencies only if you plan to generate cases or run the linters:

```sh
npm install
```

## Project layout

```
ld-gamejam/
├── index.html              # canvas host, boots js/main.js as an ES module
├── js/
│   ├── main.js             # boot: preload assets, register scenes, start loop
│   ├── gameLoop.js         # fixed-timestep loop
│   ├── sceneManager.js     # scene registry + fade transitions
│   ├── input.js            # keyboard/mouse/wheel, design-space scaling
│   ├── draw.js             # text, sprites, shapes
│   ├── assets.js           # image + audio preloader
│   ├── audio.js            # runtime audio + procedural SFX
│   ├── interrogationAudio.js / interrogationSound.js
│   ├── animations.js, math.js, collision.js, pool.js, timer.js, debug.js, tilemap.js
│   ├── gameAssets.js       # legacy constants (not used by active scenes)
│   ├── scenes/             # one file per scene (title, menu, briefing, dossier, play, verdict, result, badEnd, settings)
│   ├── game/               # domain state, case list, waveform mechanics, onboarding, stats
│   ├── ui/                 # canvas UI widgets (polygraph, dossier panel, modals, CCTV effect, theme)
│   └── i18n/               # en.js, tr.js, index.js (t() lookup)
├── assets/
│   ├── background.png / background-no-light.png
│   ├── operator.png / defendant.png
│   ├── characters/         # per-case defendant portraits (<case-id>.png)
│   ├── audio/              # case-slam.wav etc
│   ├── m5x7.ttf            # pixel body font
│   └── DepartureMonoNerdFontMono-Regular.otf
├── dialogs/                # case JSON (en-case-*.json, tr-case-*.json) — loaded at runtime
├── scripts/                # LLM pipeline + case-generation runners
├── docs/                   # dialog-generator.md
```

## Scene flow

Scenes are registered in `js/main.js` and transitioned via `setScene()` from `js/sceneManager.js`.

```
title ─▶ menu ─▶ briefing ─▶ dossier ─▶ play ─▶ verdict ─▶ result
                                              │
                                              └▶ badEnd   (suspect lawyers up / session poisoned)
```

`settings` is reachable from `title` and `menu`. Every scene exposes `update(dt)` and `render()`; the manager handles fade alpha (`getTransitionAlpha()`), which is composited in `main.js` along with a scanline overlay for the CRT look.

For a full narrative of boot → gameplay, see [`agents/core-main-flow.md`](./agents/core-main-flow.md). For per-module deep dives, start at [`agents.md`](./agents.md).

## Case data format

Each file in `dialogs/` is loaded by `js/game/cases.js` and unwrapped as `game_data`. Shape:

```jsonc
{
  "game_data": {
    "title": "string",
    "suspect": { "name": "...", "role": "...", "profile": "..." },
    "system_config": {
      "initial_fear_bar": 20,
      "max_fear_bar": 100,
      "fear_bar_description": "...",
    },
    "context": "case briefing shown in the briefing scene",
    "start_node": "node_id",
    "nodes": {
      "node_id": {
        "theme": "...",
        "description": "narration shown when entering the node",
        "is_end_state": false,
        "choices": [
          {
            "type": "EMPATHIC", // UPPER_SNAKE_CASE tactic label
            "question": "what the Operator asks",
            "answer": "what the suspect says back",
            "next_node": "node_id",
            "mechanics": {
              "heart_rate": "SPIKE", // BASELINE|STABLE|RISE|INCREASE|SPIKE|MAX_SPIKE|DROP|ERRATIC
              "breathing": "HOLDING_BREATH", // BASELINE|CALM|DEEP|SHALLOW|HOLDING_BREATH|UNEVEN|HYPERVENTILATION|CRYING
              "gsr": "SURGE", // BASELINE|STABLE|INCREASE|SPIKE|SURGE|MAX|DECREASE
              "cctv_visual": "LIP_PRESS", // free-form micro-expression label
              "korku_bari_delta": 12, // hidden stress-meter delta, roughly ±50
              "gameplay_note": "analyst-facing note",
            },
          },
        ],
      },
    },
  },
}
```

End-state nodes set `"is_end_state": true` and carry `result_text` instead of `choices`.

The case list and language tags live in [`js/game/cases-list.js`](./js/game/cases-list.js). Per-case portraits go in `assets/characters/<case-id>.png`.

## Authoring new cases

Two paths:

1. **Write JSON by hand.** Copy an existing file in `dialogs/`, edit, and add an entry to `js/game/cases-list.js`.
2. **Generate with the LLM pipeline.** The four-stage pipeline chains Claude API calls — suspect → case → nodes → assembly — and writes the result to `dialogs/<case-id>.json`. Full documentation in [`docs/dialog-generator.md`](./docs/dialog-generator.md).

Quick start for the pipeline:

```sh
cp .env.example .env            # add ANTHROPIC_API_KEY=sk-ant-...
npm install
npm run generate -- my-case-id       # English
npm run generate:tr -- my-case-id    # Turkish
```

Then register the new id in `js/game/cases-list.js` and drop a portrait at `assets/characters/<case-id>.png`.

## Scripts

Defined in `package.json`:

| Script                 | What it does                             |
| ---------------------- | ---------------------------------------- |
| `npm run generate`     | Run the English case-generation pipeline |
| `npm run generate:tr`  | Run the Turkish case-generation pipeline |
| `npm run format`       | Prettier write                           |
| `npm run format:check` | Prettier check                           |
| `npm run lint`         | ESLint over `js/**/*.js`                 |
| `npm run lint:fix`     | ESLint autofix                           |

Extra utilities in `scripts/`:

- `gen-test-images.mjs` — generates placeholder defendant portraits for testing.
- `generate-character-image.mjs` — portrait generation via `@google/genai` + `sharp`.
- `llm-pipeline.js` — the generic Claude-chaining engine the case runners build on.

## Tech notes

- **No bundler.** The browser loads `js/main.js` as an ES module directly. Stay within the module graph — no CommonJS.
- **Fixed-timestep loop.** `createGameLoop` in `js/gameLoop.js` feeds `update(dt)` at a stable rate and calls `render()` every frame.
- **Design-space rendering.** Everything is drawn against a 600×400 design canvas, then scaled to fit the window while preserving aspect ratio. Input coordinates are rescaled via `setDesignScale()`.
- **CRT feel.** A scanline overlay with breathing alpha + occasional flicker is composited every frame in `main.js`.
- **Fonts.** `m5x7.ttf` is loaded with the `FontFace` API before the first render.
- **Assets.** Images and audio are preloaded by `preloadAssets()` during boot; per-case defendant portraits (`defendant-<case-id>`) are registered dynamically from the case JSON.
- **i18n.** Strings go through `t(key)` in `js/i18n/index.js`, which picks between `en.js` and `tr.js`.

## Tooling

- Node 20+ (the generators rely on `node --env-file=.env`).
- Prettier config in `.prettierrc.json`; ignores in `.prettierignore`.
- ESLint flat config in `eslint.config.js`.
- `.env` is gitignored. Copy `.env.example` and set `ANTHROPIC_API_KEY` for case generation.

## Privacy

The deployed build uses [GoatCounter](https://www.goatcounter.com/) — a cookieless, privacy‑friendly analytics service — to count pageviews and anonymous gameplay events (case started, verdict called, bad end). No cookies are set, no personal data is collected, and no data is shared with third parties.

**Who is lying, and who is just afraid?**
