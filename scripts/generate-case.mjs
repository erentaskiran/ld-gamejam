import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPipeline, parseJsonBlock, MODEL } from './llm-pipeline.js';
import { generateCharacterImage } from './generate-character-image.mjs';

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

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const VERDICTS = ['GUILTY', 'NOT_GUILTY'];

const ROLE_CATEGORIES = [
  'blue-collar trade (welder, electrician, plumber, machinist, mechanic, truck driver, longshoreman)',
  'public sector mid-level (city inspector, social worker, parole officer, public-school teacher, librarian, court clerk)',
  'creative/arts (graphic designer, novelist, gallery owner, session musician, film editor, tattoo artist)',
  'hospitality/service (head chef, hotel night manager, sommelier, event planner, bartender, wedding caterer)',
  'healthcare front-line (ER nurse, paramedic, dental hygienist, physiotherapist, hospice midwife, lab phlebotomist)',
  'agriculture/rural (family farmer, vineyard owner, livestock vet, park ranger, beekeeper, fishery manager)',
  'small independent business owner (used bookshop, dog-grooming studio, food truck, repair shop, neighborhood pharmacy)',
  'education (high-school principal, tutoring-center owner, university adjunct, special-needs aide)',
  'transport/logistics (cargo dispatcher, dock supervisor, regional bus operator, freight conductor)',
  'religious or community-organization figure (clergy, charity director, community-center coordinator, halfway-house manager)',
  'tech/scientific specialist (forensic lab tech, cartographer, instrument calibrator, museum archivist)',
  'media/journalism (regional reporter, podcaster, documentary fixer, photo editor)',
  'athletics or coaching (youth sports coach, gym owner, professional team trainer, e-sports manager)',
  'retired or semi-retired with active side life (foster carer, neighborhood-association president, hobbyist breeder)',
];

const CHARGE_CATEGORIES = [
  'civil negligence causing injury or death (consumer product, premises liability, professional duty)',
  'inheritance dispute / will challenge / alleged elder abuse',
  'intellectual property / plagiarism / counterfeit goods claim',
  'animal welfare violation or zoning/agricultural infraction',
  'defamation / libel / civil harassment suit',
  'real-estate or rental fraud (deposit theft, fake listing, illegal eviction)',
  'food safety incident (poisoning, mislabeling, supply tampering)',
  'environmental contamination (waste dumping, well water, air quality)',
  'art or document forgery / authenticity dispute',
  'custody dispute or domestic civil action',
  'workplace safety incident in a small operation (not a corporate boardroom)',
  'religious or charitable-fund misappropriation',
  'fraudulent insurance claim or staged loss',
  'wrongful-arrest counter-suit / police misconduct civil action',
  'sports doping or athletic-eligibility fraud',
  'historical-artifact theft / cultural heritage violation',
  'professional license revocation (medical, legal, teaching) over alleged misconduct',
];

const SECONDARY_SECRET_CATEGORIES = [
  'hidden long-term addiction (alcohol, gambling, prescription meds, online betting)',
  'undisclosed child or estranged biological relative',
  'identity or credentialing fraud (forged degree, exaggerated past, borrowed CV)',
  'past criminal record long sealed or expunged',
  'undocumented immigration status of self or close family',
  'religious or political conversion kept hidden from family/community',
  'past plagiarism or academic misconduct never publicly surfaced',
  'inherited family shame (relative committed a crime, hidden suicide, family bankruptcy)',
  'covert caretaking of a stigmatized relative (severe mental illness, terminal disease)',
  'sexual orientation or gender identity hidden from a hostile community',
  'unrelated petty financial misdeed (tax dodge, undisclosed cash income, chronic shoplifting)',
  'protecting a third party who is hiding a separate secret',
  'medical secret (terminal diagnosis, infertility, past abortion) hidden from family',
  'unprocessed trauma (past abuse, accidental harm caused, witnessed violence)',
  'cult or fringe-group involvement years ago',
  'witness-protection-style relocation under a constructed identity',
];

const MEDICAL_PROFILES = [
  'clean baseline — no chronic conditions, no daily medications',
  'cardiac history on a beta-blocker (HR responses suppressed)',
  'SSRI or SNRI long-term (sympathetic blunting)',
  'pacemaker or chronic arrhythmia (HR ceiling/floor distortion)',
  'COPD or asthma (breathing instability dominant)',
  'recent pregnancy or postpartum (elevated baseline HR, hormonal lability)',
  'thyroid disorder on medication (hyper -> noisy baseline; hypo -> blunted)',
  'recovery from opioid dependency on maintenance therapy',
  'epilepsy on anticonvulsant medication',
  'autoimmune flare on corticosteroids (jittery baseline, irritability)',
  'panic disorder, unmedicated by choice',
  'recent surgery on pain management (opioid or gabapentinoid)',
  'chronic pain managed with cannabis (mild parasympathetic shift)',
  'menopause / perimenopause with vasomotor symptoms (sudden GSR surges unrelated to topic)',
  'sleep apnea, untreated, with chronic fatigue',
];

const AGE_BRACKETS = [
  '23-30 (early career, less guarded experience)',
  '31-39 (mid-career, family obligations forming)',
  '40-49 (peak responsibility, deep history)',
  '50-59 (late career, reputational stakes)',
  '60-72 (post-peak, legacy/health concerns dominate)',
];

const FAMILY_SHAPES = [
  'single, no children, close to one elderly parent',
  'long-term partner, no children, shared business or property',
  'married with one teenage child in a custody-stable home',
  'divorced co-parent of multiple children of mixed ages',
  'widowed, raising grandchildren or supporting adult children',
  'estranged from immediate family, closest to chosen family / longtime friends',
  'caretaker of a disabled sibling or chronically ill parent',
  'remarried with stepchildren and complex prior-marriage entanglements',
  'unmarried, in a long-distance relationship across borders',
];

const SUSPECT_TONE = [
  'overtly cooperative, almost too helpful',
  'curt and minimal-word, treats every question as a trap',
  'rambling and over-explanatory, buries the truth in detail',
  'stoic and emotionally flat, hard to read',
  'visibly anxious, leaks affect even on neutral questions',
  'professionally polished, lawyer-coached, careful diction',
  'angry and indignant, pushes back on the premise itself',
  'self-deprecating and apologetic, deflects via likability',
];

const ANTI_DEFAULT_PRINCIPLES = [
  'Stay out of the polished American legal-procedural register: no FDA inquiries, no class-action suits, no Phase III trial scandals, no Fortune-500 boardrooms. Prefer small-scale, regional, neighborhood-level stakes.',
  'No glossy victim/villain framing. Both sides of the dispute should have a defensible read; the morally-simple "evil corporation vs. innocent family" template is forbidden.',
  'The displaced-guilt source must not be a romantic or sexual affair. Use the secondary_secret_category from the anchor as the actual shape of the secondary secret.',
  "The suspect must not be primarily occupied with shielding a senior boss / mentor / business partner. The displaced guilt must come from the suspect's own life, not loyalty to a powerful protector figure.",
  'The medical baseline must not collapse into the stock polygraph subject (chronic anxiety + heavy caffeine + beta-blocker). Follow medical_profile from the anchor literally, including "clean baseline" when rolled.',
  'Names must fit the suspect\'s region, class, and generation specifically — no recycling of names that have appeared in this project before, and no generic "Marcus / Vanessa / Renata / Kerem"-tier defaults pulled from the model\'s prior outputs.',
];

function rollDiversityAnchor() {
  const verdict = pick(VERDICTS);
  return {
    true_verdict: verdict,
    role_category: pick(ROLE_CATEGORIES),
    charge_category: pick(CHARGE_CATEGORIES),
    secondary_secret_category: pick(SECONDARY_SECRET_CATEGORIES),
    medical_profile: pick(MEDICAL_PROFILES),
    age_bracket: pick(AGE_BRACKETS),
    family_shape: pick(FAMILY_SHAPES),
    suspect_tone: pick(SUSPECT_TONE),
    anti_default_principles: ANTI_DEFAULT_PRINCIPLES,
  };
}

const DIVERSITY = rollDiversityAnchor();
console.log('Diversity anchor for this run:');
console.log(JSON.stringify(DIVERSITY, null, 2));

const STEP_1_SUSPECT = `You are generating a suspect for a legal interrogation game.

DIVERSITY ANCHOR (HARD CONSTRAINTS — must all be satisfied):
{{diversity_anchor}}

How to use the anchor:
- true_verdict MUST equal the value above. Do not pick the other one.
- role_category dictates the SUSPECT'S PROFESSION CLASS. Pick a specific
  job inside this category. Do NOT default to a corporate executive,
  pharmaceutical role, or generic CFO/VP unless the category names it.
- charge_category dictates the LEGAL DISPUTE TYPE for STEP 2. The suspect's
  motive and secret must be plausible WITHIN this charge category.
- secondary_secret_category dictates the SECONDARY SECRET SHAPE. Do not
  substitute "workplace affair" if the category names something else.
- medical_profile dictates the SUSPECT'S MEDICAL BASELINE. Translate it
  into the medical[] and habits[] entries and into the modifiers. If the
  category says "clean baseline", use few/no medical entries and keep
  modifiers near defaults (heart_rate_suppression near 0, gsr_sensitivity
  near 1.0).
- age_bracket constrains the suspect's age.
- family_shape constrains the household / family[] composition.
- suspect_tone shapes how the suspect comes across in the profile and in
  later answer text — pick verb choice and demeanor accordingly.
- anti_default_principles is a list of structural defaults the model
  collapses into. Treat each entry as a hard constraint on your draft.
  If any single principle is violated, the output is invalid — revise
  before returning.

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
- Realistic modern role drawn from the role_category in the diversity anchor
  (NOT a default corporate executive, pharmaceutical sales rep, or
  large-firm CFO unless the anchor explicitly names that category).
- The suspect must be morally ambiguous
- profile must include:
  - background
  - career
  - personality traits
  - one suspicious detail
  - one humanizing detail
  Note: profile is INTERNAL CONTEXT for the pipeline only — it is never
  shown to the player. Be detailed here. The "humanizing detail" may
  reference the secondary secret since the player will not see this field;
  the secondary secret must NOT, however, leak into player-facing fields
  (dossier.family, dossier.priors, dossier.pressure_points, context).
- motive must connect to a potential lawsuit or wrongdoing
- secret must NOT be obvious but meaningful
- credibility must be 1-10 with subtle reasoning implied
- true_verdict is FIXED by the diversity anchor for this run. Do NOT
  override it.
  - "GUILTY" means the suspect actually is responsible (secret contains the real act)
  - "NOT_GUILTY" means the suspect is innocent of the charge even if the secret is shady
  - A NOT_GUILTY suspect must still have a REAL secondary secret causing displaced
    physiological guilt — drawn from the secondary_secret_category in the anchor.
    Their signals spike hard on the secondary secret but NOT on the core mechanism
    of the charged crime.

LAYERED SECRETS (REQUIRED):
- Every suspect must conceal AT LEAST TWO distinct things:
  PRIMARY SECRET: the fact directly relevant to the charge (may or may not be guilt)
  SECONDARY SECRET: an unrelated stressor that causes genuine stress responses.
    SHAPE IT FROM the secondary_secret_category in the diversity anchor — do
    not default to "workplace affair" unless the anchor specifies one. The
    secondary secret is the source of "displaced guilt" — signals that look
    like primary guilt but aren't. Document both in the "secret" field as:
    "PRIMARY: [charge-relevant secret]. SECONDARY: [unrelated stressor secret]."
- The secondary secret must be a genuine pressure point that produces high
  biometric responses. It must be distinguishable from the primary secret only
  by observing WHICH specific questions trigger spikes.

DOSSIER (background the player reads BEFORE interrogation):
- age: realistic age
- identity_summary: 1-2 sentence factual capsule (role, key credentials)
- family: 1-4 entries. Treat this as a researcher's neutral background sheet
  built from public records and HR forms. Each note must contain ONLY
  publicly-knowable, factual context (relationship duration, employment,
  health/custody status, dependency situation, notable circumstance).
  STRICT RULES for note (this text is SHOWN DIRECTLY TO THE PLAYER):
  - NEVER mention biometrics ("spike", "GSR", "HR", "breathing", "expect",
    "trigger", "reaction", "response").
  - NEVER use words like "leverage", "pressure point", "high-leverage",
    "key trigger", "strongest reaction", "exploit", "weak spot".
  - NEVER describe how mentioning this person AFFECTS the suspect.
  - NEVER single out one entry as "the most important" or imply which
    family member is connected to the primary charge versus a private
    matter. Treat ALL listed people with the same neutral, factual tone.
  - NEVER reference the suspect's secret, motive, or known stress topics.
  - 1-2 short sentences max, written as a personnel file would phrase it.
  Good: "Daughter, age 14. Lives full-time with the suspect since the 2021
  custody ruling. Sole financial dependent."
  Bad: "Mentioning her daughter creates the strongest biometric response in
  her profile — high-leverage point for empathic framing."
- medical: 0-3 entries. Each must include polygraph_effect explaining how the
  condition mechanically distorts the readings (e.g. anxiety disorder ->
  elevated baseline GSR; pacemaker -> suppressed heart rate swings). Phrase
  these as clinical/forensic notes a polygraph examiner would write —
  about the INSTRUMENT, not about the suspect's psychology or this case.
  Never invent diseases that conveniently reveal guilt. Never imply that a
  specific topic will trigger the condition.
- habits: 0-3 entries (medications, caffeine, sleep, substances). Each must
  include polygraph_effect. Examples: "Beta-blocker -> suppresses
  heart-rate response"; "High caffeine -> GSR baseline elevated"; "SSRI
  -> blunts sympathetic response". Same rule as medical: phrase as a
  generic clinical note, not as case-specific guidance.
- priors: 0-3 short factual bullets about prior incidents or proceedings.
  Not verdict-revealing. Do not telegraph which prior connects to the
  current charge — list them in a flat, equal tone.
- pressure_points: 2-4 short bullets describing topical sensitivities a
  prior interviewer noted. This text is SHOWN DIRECTLY TO THE PLAYER on
  the case file ("Pressure Points" section). The goal is to set TONE and
  hint at handling difficulty — NOT to provide an answer key.
  STRICT RULES:
  - NEVER write meta-game labels ("PRIMARY", "SECONDARY", "displaced
    guilt", "the real trigger", "the misdirection topic", "primary
    charge", "secondary stressor", or any equivalent).
  - NEVER predict a biometric pattern. No "GSR surges", "HR spikes",
    "breathing irregular", "fear bar rises", etc. Pressure points are
    OBSERVATIONAL notes about the SUSPECT'S DEMEANOR, not biometric
    predictions. The player must read biometrics from the live polygraph,
    not from the dossier.
  - NEVER rank triggers ("the strongest", "the sharpest", "the clearest
    dual-channel signal", "the most reliable tell"). All listed
    sensitivities must be presented with EQUAL weight.
  - NEVER name a specific person whose mention is "the key trigger" or
    similar. You may reference broad topical areas ("questions about
    workplace relationships", "details of personal finances", "the night
    in question") but must not flag any one of them as the decisive
    reveal.
  - NEVER reveal or hint at the secret. Topical areas listed should be
    the kind of things a real prior interviewer would note from
    DEMEANOR alone (defensiveness, deflection, over-explanation,
    silence, irritation), without knowing what the secret is.
  - At least one listed pressure point should be a plausible RED HERRING:
    a topical area where the suspect becomes guarded but which is not
    actually decisive for the charge. Do not label it as such; present it
    with the same weight as the others.
  - You may briefly note which interview tactic (EMPATHIC, ANALYTICAL,
    AGGRESSIVE) tends to make the suspect open up vs. shut down — kept
    generic, not tied to a specific topic.
  Format: "[Topical area or behavioral observation] — [demeanor /
  conversational pattern, NOT biometric] — [optional generic tactic
  note]". Example: "Discussion of long-term colleagues — subject becomes
  noticeably more guarded and rephrases questions before answering;
  ANALYTICAL framing tends to escalate withdrawal."
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
- The dispute MUST fall within this charge category for this run:
  {{charge_category}}
  Do NOT default to corporate fraud, pharmaceutical malpractice,
  embezzlement, kickbacks, or large-firm wrongful death unless the
  category above explicitly names them.
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
  - Mechanism-test questions produce HIGH signals — the suspect knows the
    architecture and the specifics are incriminating.
- If suspect.true_verdict == "NOT_GUILTY":
  - Suspect WILL spike hard — but only on the SECONDARY secret (displaced
    guilt). Questions about the secondary secret should produce MAX_SPIKE/
    SURGE/HOLDING_BREATH clusters, making the player think they found guilt.
  - Questions about the PRIMARY charge mechanism must produce LOW/STABLE
    signals — the suspect genuinely lacks firsthand knowledge. The fear bar
    should DROP on the mechanism-test node.
  - Hard accusation questions may produce defensive spikes but NO sustained
    MAX GSR surges paired with HR MAX_SPIKE + HOLDING_BREATH on charge-
    specific questions.
  - The success node result_text MUST describe the signal DISTRIBUTION
    (which questions spiked vs. which were stable), not just the peak values,
    so the player can correctly conclude NOT_GUILTY despite a high overall
    fear bar.
- Never fake a confession for a NOT_GUILTY suspect; reserve MAX_SPIKE + MAX
  GSR + HOLDING_BREATH / HYPERVENTILATION clusters for GUILTY truths only.

NODE COUNT AND TOPOLOGY:
- 10 to 14 total nodes (minimum 10 — shorter graphs produce trivially easy cases)
- Must include:
  - node_01_intro (intro node)
  - 7-10 investigation nodes
  - 1-2 "clean outcome" end nodes (id contains "success", e.g. node_success_*)
    Differentiate variants if 2: node_success_breakdown (full emotional collapse
    with admission) vs. node_success_partial (controlled partial admission, suspect
    keeps composure but evidence is overwhelming). Each must have a distinct
    result_text describing a different final biometric pattern.
  - 2+ "degraded outcome" end nodes (id contains "fail", e.g. node_fail_*)
    Differentiate variants where possible: e.g. node_fail_lockdown (hard legal
    shutdown) vs. node_fail_deflection (soft stonewalling — session ends but
    suspect never overtly invoked counsel, leaving signal record ambiguous).

PATH LENGTH RULES (CRITICAL FOR GAMEPLAY DEPTH):
- No end node (success or fail) may be reachable in fewer than 6 node
  transitions from the start node. The player must pass through at least
  6 content nodes before any session can conclude.
- NEVER route a wrong-move choice directly to a fail end node from an early
  node (node_01_intro or the first three content nodes). Early wrong moves must
  instead route to a DEGRADED BRANCH — a regular content node that continues
  the interrogation under worse conditions (suspect more guarded, fewer
  productive paths open, biometric baseline shifted). Reserve direct fail-node
  routing for wrong moves made in the final 2 content nodes only.
- The graph must have at least TWO CONVERGENCE POINTS: two separate pairs of
  different choice paths that both lead to the same intermediate node. This
  ensures multiple routes stay viable across the full length of the session.
- Avoid pure linear chains (A→B→C→D→end). At least two nodes must each be
  reachable from multiple preceding nodes via different routes.
- Every investigation node after the 4th must present a meaningful tension
  between a productive direction and a subtly wrong direction — the session
  must never feel automatic in its second half.

MANDATORY NODE — MECHANISM TEST (CRITICAL FOR DIFFICULTY):
- One investigation node MUST be a mechanism-knowledge test: ask the suspect to
  explain HOW the alleged wrongdoing worked in technical/procedural detail.
  - GUILTY suspect: produces HIGH signals (HR SPIKE/MAX_SPIKE, GSR SURGE/MAX)
    because they know the architecture firsthand and the specifics are
    incriminating.
  - NOT_GUILTY suspect: produces LOW/STABLE signals because they lack
    firsthand knowledge of the mechanism — surface-level description, minor
    factual errors, genuine uncertainty. The fear bar may DROP here.
  This node is the primary tool for distinguishing primary guilt from
  displaced guilt. Without it the player cannot differentiate the two.

MANDATORY NODE — FOLLOW-UP EXPLOITATION:
- One investigation node placed AFTER the mechanism test must be a follow-up
  exploitation node: the operator confronts the suspect with a specific
  inconsistency or gap revealed by the mechanism test (or an earlier answer)
  and presses for clarification. This node must:
  - Reference something concrete the suspect said in a prior node.
  - Offer at least 3 choices: (a) precise forensic follow-up, (b) empathic
    reframe that invites explanation, (c) a premature escalation that
    surrenders the leverage.
  - Produce the session's second-highest biometric cluster on the correct path.

MANDATORY NODE — SUSPECT REFRAME ATTEMPT:
- One investigation node must be a reframe attempt: the suspect tries to
  actively shift the narrative — introducing a new explanation, volunteering
  a partial concession to pre-empt a harder question, or pivoting to blame a
  third party. The operator must choose how to handle it:
  - Accept the reframe (wrong move: biometrics go quiet, suspect regains ground)
  - Gently redirect back to the original thread (progress: moderate signal)
  - Directly challenge the reframe with a contradiction (high signal, high risk)

MANDATORY — RED HERRING PATH:
- One evidence path must be a red herring: a real piece of evidence that looks
  damning but actually confirms the SECONDARY secret, not the primary crime.
  Players who follow only this path will misread it as primary guilt. The path
  must not lead to the success node — it must route to a fail or ambiguous node
  where the evidence is real but the interpretation is wrong.

CHOICES PER NODE:
- At least THREE investigation nodes must offer 3 choices (not just 2).
- The third choice in each 3-choice node must look methodologically reasonable
  but subtly undermine the session — do NOT make wrong moves obviously
  aggressive or foolish. The player should only realize it was wrong after
  seeing the mechanic result.
- In the second half of the graph (nodes 5+), at least one node must offer
  a TACTICAL RESET option: a choice that pauses the pressure and lets the
  suspect breathe — wrong in the short term (korku_bari_delta negative)
  but can open a new path rather than routing immediately to fail.

NODE FIELDS (ALL nodes, including end nodes):
- theme: short scene label, 2-5 words, Title Case or descriptive phrase
- description: 1-2 sentences of PLAYER-VISIBLE narrative. Write only what the
  operator observes in the room: the suspect's visible posture, demeanor, or
  the physical/situational context of the moment (what is on the table, the
  atmosphere, the transition between topics). STRICT RULES for description:
  - NO references to secrets, primary/secondary secrets, or hidden motives.
  - NO biometric strategy, signal predictions, or gameplay advice.
  - NO meta-game language ("red herring", "mechanism test", "displaced guilt",
    "this evidence confirms the secondary secret", "biometrically explosive", etc.).
  - Write as if the player is sitting in the interrogation room right now.
    Describe only what a real observer would physically see or feel in that moment.
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

ANSWER FIELD (CRITICAL):
- answer: The suspect's verbatim reply written in FIRST-PERSON DIRECT SPEECH.
  NEVER write third-person narration or stage directions
  (e.g. WRONG: "She pauses and says...", "He tenses, then replies...",
       "She hesitates. 'I don't know' she says.").
  Write ONLY what the suspect would literally say out loud, including
  hesitations expressed as ellipses (e.g. "I... I don't know"),
  deflections, evasions, partial admissions, or denials.
  No action descriptions. No narrator voice. No quoted speech within narration.

MECHANICS (choose the value that fits the suspect's reaction AND the
true_verdict — see SIGNAL TRUTH ALIGNMENT above):
- heart_rate: BASELINE | STABLE | RISE | INCREASE | SPIKE | MAX_SPIKE | DROP | ERRATIC
- breathing: BASELINE | CALM | DEEP | SHALLOW | HOLDING_BREATH | UNEVEN | HYPERVENTILATION | CRYING
- gsr: BASELINE | STABLE | INCREASE | SPIKE | SURGE | MAX | DECREASE
- cctv_visual: MUST be exactly one of these values (no compound or custom values):
  EYE_DART | LOOK_DOWN | RELIEVED_EXHALE | HAND_PINCH_UNDER_TABLE |
  DEFENSIVE_CROSS_ARMS | BREAKDOWN | STONE_FACE | EMPTY_STARE |
  JAW_TIGHTEN | RELEASED_SHOULDERS | LIP_PRESS | TEAR_POOLING
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

const STEP_4_EXTRAS = `You are generating only the remaining creative fields
for the final case assembly. Suspect, case, and nodes are already assembled
in code — do NOT reproduce them.

INPUT:
Suspect:
{{suspect_json}}

Case:
{{case_json}}

OUTPUT RULES:
- Return ONLY valid JSON
- No markdown, no explanation

OUTPUT:
{
  "fear_bar_description": string,
  "heart_rate_baseline": number,
  "gsr_baseline": number,
  "verdict_truth_text": string
}

RULES:
- fear_bar_description: A SHORT, GENERIC, CASE-INDEPENDENT definition of
  what the meter represents. It must read as a tooltip that would fit ANY
  case — describe ONLY that the bar tracks the suspect's accumulated
  psychological strain across the session. STRICT RULES:
  - NEVER name the suspect, any other person, family member, or topic.
  - NEVER describe which questions, themes, or relationships make the bar
    rise or fall.
  - NEVER hint at the suspect's vulnerabilities, secrets, or the verdict.
  - 1 sentence is preferred; 2 max. Should be reusable across cases.
  Example: "A composite gauge of the suspect's accumulated psychological
  strain — combining heart rate, breath irregularity, sweat response, and
  visible affect into a single tension reading."
- heart_rate_baseline: BPM number. Start from ~70 and apply
  suspect.dossier.modifiers.heart_rate_baseline_shift if meaningful.
  Typical range 60-90.
- gsr_baseline: microsiemens number. Start from ~5 and apply
  suspect.dossier.modifiers.gsr_baseline_shift if meaningful.
  Typical range 4-10.
- verdict_truth_text: 2-3 sentence reveal of what the suspect actually did
  (or didn't do). Shown on the result screen after the player commits to a
  verdict. Must be consistent with suspect.secret, suspect.motive, and
  suspect.true_verdict:
  - If GUILTY: describe the suspect's real act of wrongdoing plainly.
  - If NOT_GUILTY: name the real culprit or cause, and clarify the suspect's
    secret was shady but not the crime charged.`;

const fill = (template, vars) =>
  Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, JSON.stringify(val, null, 2)),
    template
  );

const think = (budget) => ({ type: 'enabled', budget_tokens: budget });

const steps = [
  {
    // Complex creative profile — needs Sonnet reasoning quality
    name: 'suspect',
    model: MODEL.HEAVY,
    prompt: () => fill(STEP_1_SUSPECT, { diversity_anchor: DIVERSITY }),
    parse: parseJsonBlock,
    thinking: think(4000),
    maxTokens: 12000,
  },
  {
    // Simple structured summary — Haiku is sufficient and much cheaper
    name: 'case',
    model: MODEL.LIGHT,
    prompt: (r) =>
      fill(STEP_2_CASE, {
        suspect_json: r.suspect,
        charge_category: DIVERSITY.charge_category,
      }),
    parse: parseJsonBlock,
    thinking: think(1024),
    maxTokens: 3000,
  },
  {
    // Most complex step — branching graph with 10-14 nodes — Opus for best quality
    name: 'nodes',
    model: MODEL.NODES,
    prompt: (r) => fill(STEP_3_NODES, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
    thinking: think(10000),
    maxTokens: 50000,
  },
  {
    // Four simple fields — Haiku handles this well and much faster
    name: 'extras',
    model: MODEL.LIGHT,
    prompt: (r) => fill(STEP_4_EXTRAS, { suspect_json: r.suspect, case_json: r.case }),
    parse: parseJsonBlock,
    thinking: think(1024),
    maxTokens: 3000,
  },
];

const STEP_LABELS = {
  suspect: 'Working on suspect...',
  case: 'Working on case context...',
  nodes: 'Building interrogation nodes...',
  extras: 'Generating verdict text and baselines...',
};

const { results } = await runPipeline(steps, {
  system: SYSTEM,
  onStepStart: ({ name }) => console.log(STEP_LABELS[name] ?? `Working on ${name}...`),
  onStep: ({ name, text, stopReason }) => {
    const step = steps.find((s) => s.name === name);
    const model = step?.model ?? 'default';
    console.log(`[${name}] done — ${text.length} chars, model=${model}, stop_reason=${stopReason}`);
  },
});

const suspect = results.suspect.suspect;
const caseCtx = results.case;
const nodes = results.nodes;
const extras = results.extras;

const imageOutPath = resolve('assets', 'characters', `${caseId}.png`);
console.log('Generating character image...');
await generateCharacterImage(suspect, imageOutPath);

const finalOutput = {
  game_data: {
    title: caseCtx.title,
    suspect: {
      name: suspect.name,
      role: suspect.role,
      profile: suspect.profile,
    },
    system_config: {
      initial_fear_bar: 20,
      max_fear_bar: 100,
      fear_bar_description: extras.fear_bar_description,
      heart_rate_baseline: extras.heart_rate_baseline,
      gsr_baseline: extras.gsr_baseline,
    },
    context: caseCtx.context,
    true_verdict: suspect.true_verdict,
    verdict_truth_text: extras.verdict_truth_text,
    dossier: suspect.dossier,
    start_node: nodes.start_node,
    nodes: nodes.nodes,
    character_image: `./assets/characters/${caseId}.png`,
  },
};

const outPath = resolve('dialogs', `${caseId}.json`);
writeFileSync(outPath, JSON.stringify(finalOutput, null, 2));
console.log(`wrote ${outPath}`);

const casesListPath = resolve('js', 'game', 'cases-list.js');
const casesListSrc = readFileSync(casesListPath, 'utf8');
const title = finalOutput.game_data.title ?? caseId;
const language = finalOutput.game_data.language ?? 'en';
const newEntry = `  {\n    id: '${caseId}',\n    file: './dialogs/${caseId}.json',\n    label: '${title}',\n    language: '${language}',\n  },\n`;
const updated = casesListSrc.replace(/\];\s*$/, `${newEntry}];\n`);
writeFileSync(casesListPath, updated);
console.log(`added '${caseId}' to cases-list.js`);
