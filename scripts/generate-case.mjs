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
    "true_verdict": "GUILTY" | "NOT_GUILTY",
    "dossier": {
      "age": number,
      "identity_summary": string,
      "family": [ { "relation": string, "name": string, "note": string } ],
      "medical": [ { "condition": string, "polygraph_effect": string } ],
      "habits": [ { "habit": string, "polygraph_effect": string } ],
      "priors": [ string ],
      "pressure_points": [ string ],
      "modifiers": {
        "heart_rate_suppression": number,
        "heart_rate_baseline_shift": number,
        "gsr_sensitivity": number,
        "gsr_baseline_shift": number,
        "breathing_instability": number
      }
    }
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
  - Pick the verdict that makes the case most interesting; mix both over time

DOSSIER (background the player reads BEFORE interrogation):
- age: realistic age
- identity_summary: 1-2 sentence factual capsule (role, key credentials)
- family: 1-4 entries. Relatives or close partners with a SHORT note saying
  WHY they matter to the interrogation (leverage, dependency, conflict).
- medical: 0-3 entries. Each must include polygraph_effect explaining how the
  condition distorts readings (e.g. anxiety disorder -> elevated baseline
  GSR; pacemaker -> suppressed heart rate swings). Never invent diseases
  that conveniently reveal guilt. The goal is to let the player know which
  spikes to DISCOUNT.
- habits: 0-3 entries (medications, caffeine, sleep, substances). Each must
  include polygraph_effect. Examples: "Beta-blocker -> suppresses
  heart-rate response"; "High caffeine -> GSR baseline elevated"; "SSRI
  -> blunts sympathetic response".
- priors: 0-3 short factual bullets about prior incidents or proceedings.
  Not verdict-revealing.
- pressure_points: 1-3 short bullets describing emotional or situational
  leverage. These telegraph which tactics (EMPATHIC, TRAP, EVIDENCE, etc.)
  will unlock or block the suspect.
- modifiers: numeric knobs that translate medical+habits into live polygraph
  distortion. MUST be consistent with the polygraph_effect notes. Defaults
  are 0/1; only deviate where the dossier justifies it.
  - heart_rate_suppression: 0.0-0.9. How much HR spike amplitude is muted.
    Beta-blockers (propranolol, bisoprolol) ~0.4-0.55; SSRI mild ~0.2;
    pacemaker ~0.6. Raise for each HR-suppressing agent (cap at 0.9).
  - heart_rate_baseline_shift: -12..+15 BPM additive shift on baseline.
    Hypertension +4..+10; heavy stimulant use +3..+8; bradycardia -5..-10.
  - gsr_sensitivity: 0.7-1.8 multiplier on sweat response amplitude.
    High caffeine 1.3-1.5; anxiety disorder 1.3-1.6; panic 1.5-1.8;
    anticholinergic meds / antiperspirant 0.7-0.85.
  - gsr_baseline_shift: -2..+4 uS additive shift on baseline skin
    conductance. Match chronic caffeine/anxiety patterns.
  - breathing_instability: 0.0-0.5 additive jitter on breath waveform.
    Anxiety/panic 0.2-0.35; COPD 0.25-0.4; asthma history 0.1-0.2.
  Note: medical conditions that mostly affect cognitive/neurological state
  (migraine, insomnia) still belong in medical[] for narrative context —
  they just don't get a direct numeric knob here, because the game only
  surfaces pulse, breathing, GSR, and fear to the player.
- Dossier MUST NOT spoil true_verdict. It can hint at motive/opportunity
  but must be believably available to an operator doing pre-interrogation
  research (public records, HR, medical disclosure forms).`;

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
- The polygraph signals (heart_rate, breathing, gsr) are the player's only
  hard evidence of deception. Align signals honestly with the suspect's
  true_verdict: the player must be able to read guilt or innocence from the
  biometrics.

SIGNAL TRUTH ALIGNMENT:
- The player sees four live channels: pulse, breathing, GSR, and a fear bar.
  Micro-expressions on the defendant portrait (cctv_visual) are the fifth.
  Align these around suspect.true_verdict.
- If suspect.true_verdict == "GUILTY":
  - On accusing/probing questions, suspect shows real deception tells
    (heart_rate SPIKE/MAX_SPIKE, gsr SURGE/MAX, breathing HOLDING_BREATH or
    HYPERVENTILATION, tense cctv_visual) even when the verbal answer stays
    composed.
  - Calm answers are available on empathy or soft-framing tactics.
- If suspect.true_verdict == "NOT_GUILTY":
  - Suspect may be visibly stressed (innocent people under interrogation
    spike too) but sharp deception signals should be sparse and diffuse —
    mostly RISE/INCREASE levels and SHALLOW/UNEVEN breathing, not
    MAX_SPIKE/SURGE/HOLDING_BREATH clusters.
  - Hard accusation questions may produce defensive spikes but NO sustained
    MAX GSR surges paired with HR MAX_SPIKE + HOLDING_BREATH.
- Never fake a confession for a NOT_GUILTY suspect; reserve MAX_SPIKE + MAX
  GSR + HOLDING_BREATH / HYPERVENTILATION clusters for GUILTY truths only.

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
      "gsr_baseline": number
    },
    "context": string,
    "true_verdict": "GUILTY" | "NOT_GUILTY",
    "verdict_truth_text": string,
    "dossier": <copy suspect.dossier VERBATIM from suspect input>,
    "start_node": string,
    "nodes": <copy from nodes input exactly; every node has theme,
             description, is_end_state, plus choices[] or result_text>
  }
}

RULES:
- Copy suspect.name, role, profile from input
- Copy suspect.dossier VERBATIM into game_data.dossier (all nested fields)
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
  - gsr_baseline
- Baseline values must be NUMERIC and realistic:
  - heart_rate_baseline: BPM number (typical calm range 60-90)
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
