import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline, parseJsonBlock } from './llm-pipeline.js';

const caseId = process.argv[2];
if (!caseId) {
  console.error('usage: npm run generate -- <case-id>');
  console.error('  example: npm run generate -- case-c');
  process.exit(1);
}

const SYSTEM =
  'You are a JSON generation step in a pipeline for the legal interrogation ' +
  "game 'The Operator'. Output only valid JSON matching the requested schema. " +
  'No markdown fences, no prose, no explanations.';

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
    "credibility": number,
    "true_verdict": "GUILTY" | "NOT_GUILTY"
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
- credibility must be 1-10 with subtle reasoning implied
- true_verdict is the ground truth the player must deduce from polygraph evidence:
  - "GUILTY" means the suspect actually is responsible (secret contains the real act)
  - "NOT_GUILTY" means the suspect is innocent of the charge even if the secret is shady
  - Pick the verdict that makes the case most interesting; mix both over time`;

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

CORE DESIGN PRINCIPLE (CRITICAL):
- The interrogation ends; the CASE does NOT. After reaching an end node the
  player is taken to a verdict screen and must call GUILTY / NOT_GUILTY based
  on polygraph readings accumulated throughout the session. End nodes are
  interrogation OUTCOMES, not game endings.
- The polygraph signals (heart_rate, gsr, eeg) are the player's only hard
  evidence of deception. Align signals honestly with the suspect's
  true_verdict: the player must be able to read guilt or innocence from the
  biometrics.

SIGNAL TRUTH ALIGNMENT:
- If suspect.true_verdict == "GUILTY":
  - On accusing/probing questions, suspect shows real deception tells
    (heart_rate SPIKE/MAX_SPIKE, gsr SURGE/MAX, eeg CHAOTIC/ERRATIC) even when
    the verbal answer stays composed.
  - Calm answers are available on empathy or soft-framing tactics.
- If suspect.true_verdict == "NOT_GUILTY":
  - Suspect may be visibly stressed (innocent people under interrogation
    spike too) but sharp deception signals should be sparse and diffuse —
    mostly RISE/INCREASE levels, not MAX_SPIKE/SURGE.
  - Hard accusation questions may produce defensive spikes but NO sustained
    CHAOTIC/FLATLINE EEG patterns or MAX GSR surges.
- Never fake a confession for a NOT_GUILTY suspect; reserve MAX_SPIKE + MAX
  GSR + CHAOTIC/FLATLINE EEG clusters for GUILTY truths only.

NODE COUNT:
- 5 to 7 total nodes
- Must include:
  - node_01_intro (intro node)
  - 3-4 investigation nodes
  - 1 "clean outcome" end node (id contains "success", e.g. node_success_*)
    — suspect cooperates / confesses / breaks; strong signal pattern
  - 1+ "degraded outcome" end nodes (id contains "fail", e.g. node_fail_*)
    — suspect lawyers up / locks down / deflects; ambiguous signal pattern

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
- result_text: interrogation-outcome summary (what state the suspect is in
  now — confessed, locked down, partial admission, evasive). Must NOT
  pre-declare guilt or innocence; the player still has to judge from the
  polygraph log.
- NO choices

CHOICE.type:
- Free-form UPPER_SNAKE_CASE descriptive label conveying the tactic
- Pick names that reflect the move: ANALYTICAL, EMPATHIC, FORENSIC_CALL_OUT,
  AGGRESSIVE, STRATEGIC, LEGAL_THREAT, MORAL_PRESSURE, NARROW_TARGET,
  SYSTEMIC_READ, GULLIBLE, TRAP, PRESSURE, EVIDENCE — or invent something
  equally specific to the scene
- Note: use EMPATHIC (not EMPATHETIC) to match existing data

MECHANICS (choose the value that fits the suspect's reaction AND the
true_verdict — see SIGNAL TRUTH ALIGNMENT above):
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
- At least one misleading path that weakens the interrogation (pushes to a
  degraded end node where the suspect locks down)
- Strong questioning -> "success" end node (cleaner evidence pattern)
- Weak questioning -> "fail" end node (ambiguous evidence pattern)
- Remember: neither outcome decides the case; they just determine how much
  evidence the player carries into the verdict screen
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
      "fear_bar_description": string,
      "heart_rate_baseline": number,
      "eeg_baseline": number,
      "gsr_baseline": number
    },
    "context": string,
    "true_verdict": "GUILTY" | "NOT_GUILTY",
    "verdict_truth_text": string,
    "start_node": string,
    "nodes": <copy from nodes input exactly; every node has theme,
             description, is_end_state, plus choices[] or result_text>
  }
}

RULES:
- Copy suspect.name, role, profile from input
- Use title and context from case input
- Copy suspect.true_verdict VERBATIM into game_data.true_verdict
- Generate verdict_truth_text: 2-3 sentence reveal of what the suspect
  actually did (or didn't do). Shown on the result screen after the player
  commits to a verdict. Must be consistent with suspect.secret,
  suspect.motive, and true_verdict:
  - If GUILTY: describe the suspect's real act of wrongdoing plainly
  - If NOT_GUILTY: name the real party or cause, and clarify that the
    suspect's secret was shady but not the crime charged
- Use start_node and nodes from nodes input VERBATIM — do not reshape or drop
  fields. Preserve theme, description, is_end_state, choices, mechanics,
  next_node, result_text exactly as given.
- fear_bar_description should explain emotional/psychological pressure tracking
- Add baseline biometric values to system_config only:
  - heart_rate_baseline
  - eeg_baseline
  - gsr_baseline
- Baseline values must be NUMERIC and realistic:
  - heart_rate_baseline: BPM number (typical calm range 60-90)
  - eeg_baseline: microvolt level number (typical calm range 18-35)
  - gsr_baseline: microsiemens number (typical calm range 4-10)
- These baseline values should be calm/neutral defaults that match your
  generated case.
- Do not include extra fields
- Ensure valid JSON`;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, JSON.stringify(val, null, 2)),
    template
  );

const steps = [
  {
    name: 'suspect',
    prompt: STEP_1_SUSPECT,
    parse: parseJsonBlock,
  },
  {
    name: 'case',
    prompt: (r) => fill(STEP_2_CASE, { suspect_json: r.suspect }),
    parse: parseJsonBlock,
  },
  {
    name: 'nodes',
    prompt: (r) => fill(STEP_3_NODES, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
  },
  {
    name: 'final',
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

const outPath = resolve('dialogs', `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(results.final, null, 2));
console.log(`wrote ${outPath}`);
