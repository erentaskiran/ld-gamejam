export const EN = {
  // title / common
  APP_TITLE: 'THE OPERATOR',
  GAME_SUBTITLE: '[ POLYGRAPH INTERROGATION SIMULATOR ]',
  GAME_TAGLINE: 'YOU REVEAL THE TRUTH',
  PRESS_ANY_KEY: '>> PRESS ANY KEY TO START <<',
  LOADING: 'Loading...',
  LOAD_FAIL_TITLE: 'Game could not be started',

  // menu
  MENU_CASE_SELECT: '[ CASE SELECTION ]',
  MENU_CASE_LOAD_ERROR: 'Case could not be loaded.',
  MENU_KEY_INSTRUCTIONS: 'NUMBER KEYS: SELECT CASE',
  MENU_ENTER_START: '>> ENTER: START <<',
  STAT_NEW: 'NEW',
  STAT_SHORT_CORRECT: 'COR',
  STAT_SHORT_FAIL: 'FAIL',
  LANG_TOGGLE_HINT: 'L: TR',

  // dossier
  DOSSIER_TITLE: '[ DEFENDANT DOSSIER ]',
  DOSSIER_IDENTITY: 'IDENTITY',
  DOSSIER_NAME: 'Name',
  DOSSIER_ROLE: 'Role',
  DOSSIER_AGE: 'Age',
  DOSSIER_FAMILY: 'FAMILY & RELATIONS',
  DOSSIER_HEALTH: 'HEALTH STATUS',
  DOSSIER_POLY_TAG: 'POLYGRAPH',
  DOSSIER_HABITS: 'HABITS / MEDICATION',
  DOSSIER_PRIORS: 'PAST RECORDS',
  DOSSIER_PRESSURE: 'PRESSURE POINTS',
  DOSSIER_CASE_SUMMARY: 'CASE SUMMARY',
  DOSSIER_START_BTN: '>> START INTERROGATION (ENTER) <<',
  DOSSIER_FOOTER: 'ESC: Menu  |  Scroll: Scroll',
  DOSSIER_DEFAULT_NAME: 'DEFENDANT',
  PLAY_OPERATOR_LABEL: 'OPERATOR',

  // verdict
  VERDICT_TITLE: '[ VERDICT PHASE ]',
  VERDICT_SUSPECT_PREFIX: 'DEFENDANT: ',
  VERDICT_SUMMARY_HEADER: 'INTERROGATION SUMMARY',
  VERDICT_EVIDENCE_HEADER: 'POLYGRAPH EVIDENCE',
  VERDICT_HEART: 'HEART',
  VERDICT_STATS_FEAR: 'FEAR BAR FINAL:',
  VERDICT_STATS_QUESTIONS: 'QUESTIONS:',
  VERDICT_STATS_STRESS: 'STRESS SCORE:',
  VERDICT_PROMPT: 'READ THE POLYGRAPH. ARE YOU CONVINCED THE DEFENDANT IS GUILTY?',
  VERDICT_GUILTY_BTN: '[1] GUILTY',
  VERDICT_GUILTY_SUB: 'Polygraph caught their lies',
  VERDICT_NOT_GUILTY_BTN: '[2] NOT GUILTY',
  VERDICT_NOT_GUILTY_SUB: 'Insufficient evidence',
  VERDICT_INSTRUCTIONS: '1 / 2 / MOUSE: GIVE VERDICT',
  VERDICT_NO_RECORD: 'No interrogation record.',
  VERDICT_WAVE_HR: 'HR',
  VERDICT_WAVE_BREATHING: 'BR',
  VERDICT_WAVE_GSR: 'GS',

  // result
  RESULT_CORRECT: '[ CORRECT VERDICT ]',
  RESULT_WRONG: '[ WRONG VERDICT ]',
  RESULT_YOUR_VERDICT: 'YOUR VERDICT:',
  RESULT_TRUE_VERDICT: 'TRUTH:',
  RESULT_TRUTH_STORY: 'THE TRUE STORY OF THE CASE',
  RESULT_INTERROGATION_RESULT: 'INTERROGATION RESULT',
  RESULT_INSTRUCTIONS: 'R: Replay  |  ESC: Menu',
  RESULT_ERROR: '[ ERROR ]',
  VERDICT_LABEL_GUILTY: 'GUILTY',
  VERDICT_LABEL_NOT_GUILTY: 'NOT GUILTY',

  // settings
  SETTINGS_TITLE: '[ SETTINGS ]',
  SETTINGS_LANGUAGE_LABEL: 'LANGUAGE',
  SETTINGS_SCROLL_LABEL: 'INVERT SCROLL',
  SETTINGS_SOUND_LABEL: 'SOUND',
  SETTINGS_SCROLL_ON: 'ON',
  SETTINGS_SCROLL_OFF: 'OFF',
  SETTINGS_LANGUAGE_EN: 'ENGLISH',
  SETTINGS_LANGUAGE_TR: 'TURKCE',
  SETTINGS_BACK: 'ESC: Back to Menu',
  MENU_SETTINGS_HINT: 'S: Settings',
  MENU_BRIEFING_HINT: 'B: Briefing',

  // briefing
  BRIEFING_TITLE: '[ OPERATOR BRIEFING ]',
  BRIEFING_HINT_NEXT: 'ENTER / → : Next',
  BRIEFING_HINT_BACK: '← : Back',
  BRIEFING_HINT_STATE: 'SPACE : Next state',
  BRIEFING_HINT_EXIT: 'ESC : Menu',
  BRIEFING_INTRO_TITLE: 'READING THE ROOM',
  BRIEFING_INTRO_BODY:
    'You have four live channels and one body-language channel. Pulse, breathing, GSR, the fear bar on screen, and the defendant portrait in the corner. No readout ever tells you "liar" — you read the waveforms yourself. This briefing walks each signal through its states so you know what to look for.',
  BRIEFING_PULSE_TITLE: 'PULSE',
  BRIEFING_PULSE_BODY:
    'Heart rate rises with stress and drops when the suspect feels safe. Watch QRS spike height and beat density. Beta-blockers flatten the response even when the suspect is clearly cornered — always check the dossier before trusting a calm pulse.',
  BRIEFING_BREATHING_TITLE: 'BREATHING',
  BRIEFING_BREATHING_BODY:
    'Breath shape reveals control. Deep sine = composed. Shallow fast = defensive. Long flat plateaus with a gasp = the suspect is holding their breath — a deliberate manipulation attempt. Crying shows tremor on top of a fast sine.',
  BRIEFING_GSR_TITLE: 'GSR (SKIN CONDUCTANCE)',
  BRIEFING_GSR_BODY:
    'Sweat response fires 1-3 seconds after emotional spikes. Baseline is a near-flat line; a SPIKE or SURGE jumps visibly within the marker window. Heavy caffeine and anxiety raise baseline and amplify reactions — again, dossier first.',
  BRIEFING_FEAR_TITLE: 'FEAR BAR',
  BRIEFING_FEAR_BODY:
    'Aggregate pressure. It rises when you land true contradictions or empathy hits, and falls hard when you misfire (aggressive attack on a calm suspect, legal threats too early). High fear = mask slipping. Zero fear = they are back in control.',
  BRIEFING_CCTV_TITLE: 'DEFENDANT PORTRAIT',
  BRIEFING_CCTV_BODY:
    'Micro-expressions and body cues render as visual effects on the portrait during each answer. A red jittery tint = tense, warm red pulse + wobble = breakdown, cool purple sag = defensive cross-arms, desaturated stillness = controlled stone face, warm glow = relief. No text label — read the portrait.',
  BRIEFING_MODIFIERS_TITLE: 'MEDICAL & HABITS',
  BRIEFING_MODIFIERS_BODY:
    'Every dossier lists medical conditions and habits with a "polygraph_effect" note. These are real: a beta-blocker really does mute pulse spikes, caffeine really does amplify GSR, anxiety really does destabilize breathing. Read the dossier before reading the chart — the signal model is already accounting for them.',
  BRIEFING_CLOSE_TITLE: 'YOU ARE THE OPERATOR',
  BRIEFING_CLOSE_BODY:
    'No signal is proof on its own. Cross-check two channels with the dossier before you commit to a verdict. Wrong verdicts have consequences. Press ENTER to return to case selection.',

  // polygraph / UI
  POLY_HEADER: 'POLYGRAPH SIGNALS',
  POLY_FEAR: 'FEAR',
  POLY_PULSE: 'PULSE',
  POLY_BREATHING: 'BREATH',
  POLY_GSR: 'GSR',
  DIALOGUE_ANSWER_HEADER: '[ ANSWER ]',
  DIALOGUE_YOU_PREFIX: 'YOU: ',
  DIALOGUE_SKIP_HINT: 'Skip with ENTER',
  CHOICE_MODAL_TITLE: 'SELECT QUESTION',
  LOG_HEADER: '[ LOG ]',

  // pause menu
  PAUSE_TITLE: '[ PAUSED ]',
  PAUSE_CONTINUE: 'CONTINUE',
  PAUSE_SETTINGS: 'SETTINGS',
  PAUSE_QUIT: 'QUIT TO MENU',

  // tutorial
  TUTORIAL_NEXT: 'NEXT (ENTER / CLICK)',
  TUTORIAL_SKIP: 'ESC: SKIP',
  TUTORIAL_STEP: 'STEP',
  TUTORIAL_OF: '/',
  TUTORIAL_POLYGRAPH_TITLE: 'POLYGRAPH PANEL',
  TUTORIAL_POLYGRAPH_BODY:
    'Shows the suspect\u2019s pulse, brain and skin reactions. Colored bands during questions mark the intensity of their response.',
  TUTORIAL_DOSSIER_TITLE: 'DEFENDANT DOSSIER',
  TUTORIAL_DOSSIER_BODY:
    'Review medical notes, habits and pressure points. Some conditions can distort the polygraph readings.',
  TUTORIAL_LOG_TITLE: 'CONVERSATION LOG',
  TUTORIAL_LOG_BODY: 'Re-read everything that has been said during the interrogation here.',
  TUTORIAL_CHOICES_TITLE: 'QUESTIONS',
  TUTORIAL_CHOICES_BODY:
    'Click or press 1-9 to pick a question. Each one will provoke a different reaction.',

  // language / case filtering
  MENU_NO_CASES: 'NO CASES AVAILABLE FOR THIS LANGUAGE',
  WARN_LANG_MISMATCH: '! LANGUAGE CHANGED DURING CASE — CONTENT REMAINS IN ORIGINAL LANGUAGE',
};
