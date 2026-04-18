# Dialog Generator Pipeline

A Node script for authoring interrogation case JSON by chaining Claude API calls. Output lands in `dialogs/<case-id>.json`, where the game loads it at runtime.

- Pipeline library: [`scripts/llm-pipeline.js`](../scripts/llm-pipeline.js)
- English runner: [`scripts/generate-case.mjs`](../scripts/generate-case.mjs)
- Turkish runner: [`scripts/generate-case-tr.mjs`](../scripts/generate-case-tr.mjs)

`dialogs/` holds only game data (JSON). All generator code lives under `scripts/`.

## Why a pipeline?

Generating a full case in one shot is unreliable — the model has to invent a premise, cast, branching tree, and physiological signals all at once, and the JSON blows past sensible token limits. Splitting the work into numbered stages means:

- each stage is small enough to verify by eye,
- later stages reference earlier ones (the model sees the full conversation, not just the last reply),
- any stage can be re-run without restarting from scratch.

## The four stages

The runners are pre-wired with four steps. Each step's output is parsed as JSON and fed into the next step's prompt via `{{…_json}}` placeholders, while the full chat history also stays in the `messages` array so Claude sees every prior turn.

| # | Step     | Output                                                    | Consumes                 |
| - | -------- | --------------------------------------------------------- | ------------------------ |
| 1 | Suspect  | `{ suspect: { name, role, profile, motive, secret, credibility } }` | —                |
| 2 | Case     | `{ title, context }`                                      | suspect                  |
| 3 | Nodes    | `{ start_node, nodes: {…} }` — branching interrogation graph | suspect + case        |
| 4 | Assembly | `{ game_data: {…} }` — final shape written to disk        | suspect + case + nodes   |

## Mental model

```
prompt 1 ──▶ response 1 ─┐
                         ├─▶ prompt 2 ──▶ response 2 ─┐
                         │                            ├─▶ prompt 3 ──▶ response 3 ─┐
                         │                            │                            ├─▶ prompt 4 ──▶ dialogs/<case-id>.json
                   appended to                  appended to                  appended to
                   conversation                 conversation                 conversation
```

## One-time setup

```sh
npm install
cp .env.example .env   # then edit .env and paste your key
```

`.env` is already gitignored. Only the `ANTHROPIC_API_KEY` variable matters:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Running it

English case:

```sh
npm run generate -- case-c
```

Turkish case:

```sh
npm run generate:tr -- sessiz-tanik
```

Under the hood: `node --env-file=.env scripts/generate-case[-tr].mjs <case-id>`. The `--env-file` flag loads `.env` into `process.env` (Node 20+), the SDK reads `ANTHROPIC_API_KEY` from there, and the runner writes `dialogs/<case-id>.json`.

After the file is written, register it in `js/game/cases.js` if you want it selectable in-game.

## Target schema

The file written to disk is the same shape as `dialogs/sessiz-commit.json`:

```
{
  "game_data": {
    "title": string,
    "suspect": { "name": string, "role": string, "profile": string },
    "system_config": {
      "initial_fear_bar": 20,
      "max_fear_bar": 100,
      "fear_bar_description": string
    },
    "context": string,
    "start_node": string,
    "nodes": { "<node_id>": { … } }
  }
}
```

**Every node** (both branching and end nodes) carries `theme`, `description`, and `is_end_state`. Non-end nodes also carry `choices[]`; end nodes carry `result_text` instead.

Each choice has `type` (UPPER_SNAKE_CASE tactic label — ANALYTICAL, EMPATHIC, FORENSIC_CALL_OUT, MORAL_PRESSURE, SYSTEMIC_READ, GULLIBLE, etc.), `question`, `answer`, `next_node`, and `mechanics`:

- `heart_rate`: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- `breathing`: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- `gsr`: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
- `eeg`: BASELINE | FOCUSED | INCREASE | CHAOTIC | ERRATIC | DROP | FLATLINE
- `cctv_visual`: free-form UPPER_SNAKE_CASE micro-expression (LIP_PRESS, TEAR_POOLING, BREAKDOWN, …)
- `korku_bari_delta`: integer, roughly ±50 — negative = wrong move, positive = cracks facade
- `gameplay_note`: analyst-facing note tagging the signal

## Customizing the prompts

Edit the `STEP_*` template strings in `scripts/generate-case.mjs` (or `-tr.mjs` for Turkish). The `fill(template, vars)` helper at the bottom of each script swaps in `{{suspect_json}}`, `{{case_json}}`, and `{{nodes_json}}` as pretty-printed JSON.

The pipeline-level `SYSTEM` prompt at the top of each runner tells the model to output only JSON, no markdown, no prose.

## Defining your own pipeline

If you want a different shape, the pipeline runner itself is generic:

```js
import { runPipeline, parseJsonBlock } from "./llm-pipeline.js";

const { results } = await runPipeline(
  [
    { name: "premise", prompt: "PROMPT 1 TEXT", parse: parseJsonBlock },
    {
      name: "nodes",
      prompt: (r) => `Given:\n${JSON.stringify(r.premise)}\n\nPROMPT 2 TEXT`,
      parse: parseJsonBlock,
    },
  ],
  { system: "You are a JSON generator.", thinking: true }
);
```

## Step shape

| Field       | Type                              | Notes                                                                 |
| ----------- | --------------------------------- | --------------------------------------------------------------------- |
| `name`      | `string`                          | Key under which the result is stored. Defaults to `step_1`, `step_2`. |
| `prompt`    | `string` or `(results) => string` | The user turn. Function form reads prior results.                     |
| `parse`     | `(text) => any`                   | Optional. Transforms the raw text before storing in `results[name]`.  |
| `system`    | `string`                          | Per-step override of the pipeline-level system prompt.                |
| `model`     | `string`                          | Per-step model override.                                              |
| `maxTokens` | `number`                          | Per-step token ceiling.                                               |
| `thinking`  | `boolean`                         | Per-step adaptive-thinking toggle.                                    |

## Pipeline options

Passed as the second argument to `runPipeline`:

| Option      | Default           | Notes                                                                 |
| ----------- | ----------------- | --------------------------------------------------------------------- |
| `system`    | `undefined`       | System prompt used for every step unless the step overrides it.       |
| `model`     | `claude-opus-4-7` | Model used for every step unless the step overrides it.               |
| `maxTokens` | `16000`           | Token ceiling used for every step unless the step overrides it.       |
| `thinking`  | `true`            | Adaptive thinking on by default — flip to `false` for cheap steps.    |
| `onStep`    | `undefined`       | Called after each step with `{ name, index, prompt, text, results }`. |
| `signal`    | `undefined`       | `AbortSignal` to cancel the whole pipeline mid-flight.                |

## Return value

`runPipeline` returns `{ results, messages }`.

- `results` — object keyed by step name. Contains the raw text, or whatever `parse` returned.
- `messages` — the full `[user, assistant, user, assistant, ...]` transcript. Useful for debugging.

## Helpers

- `parseJsonBlock(text)` — pulls JSON out of a ```` ```json ```` fenced block if present, otherwise parses the whole string. Attach as `parse:` on any step whose output should be a JSON object rather than raw text.
- `extractText(response)` — concatenates the `text` blocks from an SDK response.
- `callClaude(...)` — single-shot call if you want to bypass the pipeline.

## Troubleshooting

- **`ANTHROPIC_API_KEY is not set`** — you forgot to copy `.env.example` to `.env` or forgot the `--env-file=.env` flag (the `npm run` scripts include it; direct `node …` invocations do not).
- **`parseJsonBlock: Unexpected token`** — the model wrapped its reply in prose despite the system prompt. Re-run; if it recurs, tighten the step's `prompt` with "Return ONLY valid JSON. No prose." or lower `thinking` for that step.
- **`next_node` points at a missing id** — step 3 violated its own validation rule. Re-run; if it recurs, add an explicit list of required node ids to the step 3 prompt.
- **Output drifts from the schema** — compare against `dialogs/sessiz-commit.json` and update the `STEP_3_NODES` / `STEP_4_ASSEMBLE` templates to tighten the example.
