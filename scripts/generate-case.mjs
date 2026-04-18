import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline, parseJsonBlock } from "./llm-pipeline.js";

const caseId = process.argv[2];
if (!caseId) {
  console.error("usage: npm run generate -- <case-id>");
  console.error("  example: npm run generate -- case-c");
  process.exit(1);
}

const SYSTEM =
  "You are a JSON generation step in a pipeline for the legal interrogation " +
  "game 'The Operator'. Output only valid JSON matching the requested schema. " +
  "No markdown fences, no prose, no explanations.";

const STEP_1_SUSPECT = `You are generating a suspect for a legal interrogation game.

OUTPUT RULES:
- Return ONLY valid JSON
- No markdown, no explanation

OUTPUT:
{
  "suspect": {
    "name": string,
    "role": string,
    "profile": string,
    "motive": string,
    "secret": string,
    "credibility": number
  }
}

RULES:
- Realistic modern role (e.g. restaurant owner, contractor, CFO, landlord, doctor)
- The suspect must be morally ambiguous
- profile must include:
  - background
  - career
  - personality traits
  - one suspicious detail
  - one humanizing detail
- motive must connect to a potential lawsuit or wrongdoing
- secret must NOT be obvious but meaningful
- credibility must be 1-10 with subtle reasoning implied`;

const STEP_2_CASE = `You are generating a legal case context.

INPUT:
{{suspect_json}}

OUTPUT RULES:
- Return ONLY valid JSON

OUTPUT:
{
  "title": string,
  "context": string
}

RULES:
- Must describe a legal dispute or lawsuit
- Clearly define:
  - who is accusing whom
  - what happened
  - why the suspect is under investigation
- Must include ambiguity (not clearly guilty or innocent)
- Should naturally connect to the suspect's motive and secret
- Keep context concise (4-6 sentences)`;

const STEP_3_NODES = `You are generating a branching interrogation graph for a legal game.

INPUT:
Suspect:
{{suspect_json}}

Case:
{{case_json}}

OUTPUT RULES:
- Return ONLY valid JSON

OUTPUT SHAPE:
{
  "start_node": "node_01_intro",
  "nodes": {
    "<node_id>": {
      "theme": string,
      "description": string,
      "is_end_state": false,
      "choices": [
        {
          "type": string,
          "question": string,
          "answer": string,
          "mechanics": {
            "heart_rate": string,
            "breathing": string,
            "gsr": string,
            "eeg": string,
            "cctv_visual": string,
            "korku_bari_delta": number,
            "gameplay_note": string
          },
          "next_node": string
        }
      ]
    },
    "<end_node_id>": {
      "theme": string,
      "description": string,
      "is_end_state": true,
      "result_text": string
    }
  }
}

RULES:

NODE COUNT:
- 5 to 7 total nodes
- Must include:
  - node_01_intro (intro node)
  - 3-4 investigation nodes
  - exactly 1 success end node (id contains "success", e.g. node_success_*)
  - 1+ fail end nodes (id contains "fail", e.g. node_fail_*)

NODE FIELDS (ALL nodes, including end nodes):
- theme: short scene label, 2-5 words, Title Case or descriptive phrase
- description: one or two sentences setting the scene for the player (the operator)
- is_end_state: boolean

NON-END NODES:
- is_end_state: false
- at least 2 choices
- NO result_text

END NODES:
- is_end_state: true
- result_text: in-game payoff text shown to the player
- NO choices

CHOICE.type:
- Free-form UPPER_SNAKE_CASE descriptive label conveying the tactic
- Pick names that reflect the move: ANALYTICAL, EMPATHIC, FORENSIC_CALL_OUT,
  AGGRESSIVE, STRATEGIC, LEGAL_THREAT, MORAL_PRESSURE, NARROW_TARGET,
  SYSTEMIC_READ, GULLIBLE, TRAP, PRESSURE, EVIDENCE — or invent something
  equally specific to the scene
- Note: use EMPATHIC (not EMPATHETIC) to match existing data

MECHANICS (choose the value that fits the suspect's reaction):
- heart_rate: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- breathing: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- gsr: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
- eeg: BASELINE | FOCUSED | INCREASE | CHAOTIC | ERRATIC | DROP | FLATLINE
- cctv_visual: free-form UPPER_SNAKE_CASE descriptive micro-expression or body
  cue (LIP_PRESS, JAW_TIGHTEN, EYE_DART, TEAR_POOLING, STONE_FACE,
  BREAKDOWN, EMPTY_STARE, RELEASED_SHOULDERS, DEFENSIVE_CROSS_ARMS,
  RELIEVED_EXHALE, LOOK_DOWN, MICRO_TWITCH, FROZEN, AVOIDANCE, etc.)
- korku_bari_delta: integer, roughly -50 to +50
  - negative = wrong move, suspect regains control
  - positive = right move, cracks the facade
- gameplay_note: short analyst-facing note tagging the signal
  (e.g. "LIE SIGNAL: ...", "PARTIAL TRUTH: ...", "WRONG MOVE: ...",
  "PROGRESS: ...", "CORRECT MOVE: ...")

GAMEPLAY DESIGN:
- At least one contradiction-discovery path (forensic / evidence-based)
- At least one misleading path (looks right but triggers fail)
- Good reasoning -> success node
- Poor reasoning -> fail node
- Answers must feel realistic (defensive, evasive, pressured, technical)

VALIDATION:
- All next_node values must refer to an existing node id in "nodes"
- start_node must exist in "nodes"`;

const STEP_4_ASSEMBLE = `You are assembling the final game JSON.

INPUT:
Suspect:
{{suspect_json}}

Case:
{{case_json}}

Nodes:
{{nodes_json}}

OUTPUT RULES:
- Return ONLY valid JSON
- Must match schema EXACTLY

OUTPUT:
{
  "game_data": {
    "title": string,
    "suspect": {
      "name": string,
      "role": string,
      "profile": string
    },
    "system_config": {
      "initial_fear_bar": 20,
      "max_fear_bar": 100,
      "fear_bar_description": string
    },
    "context": string,
    "start_node": string,
    "nodes": <copy from nodes input exactly; every node has theme,
             description, is_end_state, plus choices[] or result_text>
  }
}

RULES:
- Copy suspect.name, role, profile from input
- Use title and context from case input
- Use start_node and nodes from nodes input VERBATIM — do not reshape or drop
  fields. Preserve theme, description, is_end_state, choices, mechanics,
  next_node, result_text exactly as given.
- fear_bar_description should explain emotional/psychological pressure tracking
- Do not include extra fields
- Ensure valid JSON`;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (acc, [key, val]) =>
      acc.replaceAll(`{{${key}}}`, JSON.stringify(val, null, 2)),
    template
  );

const steps = [
  {
    name: "suspect",
    prompt: STEP_1_SUSPECT,
    parse: parseJsonBlock,
  },
  {
    name: "case",
    prompt: (r) => fill(STEP_2_CASE, { suspect_json: r.suspect }),
    parse: parseJsonBlock,
  },
  {
    name: "nodes",
    prompt: (r) =>
      fill(STEP_3_NODES, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
  },
  {
    name: "final",
    prompt: (r) =>
      fill(STEP_4_ASSEMBLE, {
        suspect_json: r.suspect,
        case_json: r.case,
        nodes_json: r.nodes,
      }),
    parse: parseJsonBlock,
  },
];

const { results } = await runPipeline(steps, {
  system: SYSTEM,
  thinking: true,
  onStep: ({ name, text }) => console.log(`[${name}] ${text.length} chars`),
});

const outPath = resolve("dialogs", `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(results.final, null, 2));
console.log(`wrote ${outPath}`);
