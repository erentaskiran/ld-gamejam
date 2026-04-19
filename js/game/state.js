import { clamp } from '../math.js';
import { CASES } from './cases.js';
import { applyMechanicsToBiometrics, resetBiometricsOnState } from './waves.js';
import { t } from '../i18n/index.js';

export const state = {
  gameData: null,
  loading: true,
  error: '',
  currentNodeId: '',
  currentNode: null,
  fearBar: 0,
  maxFearBar: 100,
  topLog: [],
  prompt: '',
  note: '',
  lastQuestion: '',
  lastAnswer: '',
  responseMode: false,
  responseTimer: 0,
  pendingNodeId: '',
  choiceRects: [],
  questionProgress: 0,
  answerProgress: 0,
  fearBarDisplay: 0,
  fearFlash: 0,
  menuCaseRects: [],
  caseIndex: 0,
  caseDataById: {},
  evidence: [],
  verdict: '',
  trueVerdict: '',
  interrogationOutcome: null,
  polygraphMarkers: [],
  markerCapture: null,
  metrics: {
    heartRate: 'BASELINE',
    gsr: 'BASELINE',
    breathing: 'BASELINE',
    cctvVisual: 'NEUTRAL',
  },
  wave: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  waveTarget: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  time: 0,
};

export function getSuspectLabel() {
  const name = state.gameData?.suspect?.name;
  return name ? String(name).toUpperCase() : t('DOSSIER_DEFAULT_NAME');
}

export function getSelectedCaseDef() {
  return CASES[state.caseIndex] || CASES[0];
}

export function getSelectedCaseData() {
  const selected = getSelectedCaseDef();
  return state.caseDataById[selected.id] || null;
}

export function setSelectedCase(index) {
  state.caseIndex = clamp(index, 0, CASES.length - 1);
  state.gameData = getSelectedCaseData();
}

export function pushLog(text) {
  state.topLog.push(text);
  while (state.topLog.length > 40) {
    state.topLog.shift();
  }
}

function finalizeMarkerCapture() {
  const m = state.markerCapture;
  if (!m) {
    return;
  }

  const minMarkerDuration = 0.12;
  const endTime = Math.max(state.time, (m.startTime ?? state.time) + minMarkerDuration);

  state.polygraphMarkers.push({
    qIndex: m.qIndex,
    startTime: m.startTime,
    endTime,
    hrPeak: m.peakHr,
    breathingPeak: m.peakBreathing,
    gsrPeak: m.peakGsr,
    hrCategory: m.hrCategory,
    breathingCategory: m.breathingCategory,
    gsrCategory: m.gsrCategory,
    samples: {
      hr: m.samples.hr.slice(),
      breathing: m.samples.breathing.slice(),
      gsr: m.samples.gsr.slice(),
    },
  });
  state.markerCapture = null;
}

export function setNode(nodeId) {
  const node = state.gameData.nodes[nodeId];
  if (!node) {
    state.error = `Node not found: ${nodeId}`;
    state.currentNode = null;
    return { ok: false, isEnd: true };
  }

  finalizeMarkerCapture();

  state.currentNodeId = nodeId;
  state.currentNode = node;
  state.responseMode = false;
  state.responseTimer = 0;
  state.pendingNodeId = '';
  state.prompt = '';
  state.choiceRects = [];

  return { ok: true, isEnd: !!node.is_end_state };
}

const MARKER_MAX_SAMPLES = 180;

function latestRingSample(buffer) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const idx = (buffer.head - 1 + buffer.size) % buffer.size;
  return buffer.data[idx];
}

export function updateMarkerCapture() {
  const m = state.markerCapture;
  if (!m || !state.biometric) {
    return;
  }
  const readout = state.biometric.readout;
  const baseline = state.biometric.baseline;
  const buffers = state.biometric.buffers;
  if (!readout || !baseline || !buffers) {
    return;
  }

  const hrDelta = Math.abs((readout.bpm ?? 0) - (baseline.bpm ?? 0));
  const breathingDelta = Math.abs((readout.breathingRpm ?? 0) - (baseline.breathingRpm ?? 0));
  const gsrDelta = Math.abs((readout.gsrUs ?? 0) - (baseline.gsrUs ?? 0));
  if (hrDelta > m.peakHr) m.peakHr = hrDelta;
  if (breathingDelta > m.peakBreathing) m.peakBreathing = breathingDelta;
  if (gsrDelta > m.peakGsr) m.peakGsr = gsrDelta;

  m.samples.hr.push(latestRingSample(buffers.heartRate));
  m.samples.breathing.push(latestRingSample(buffers.breathing));
  m.samples.gsr.push(latestRingSample(buffers.gsr));
  if (m.samples.hr.length > MARKER_MAX_SAMPLES) m.samples.hr.shift();
  if (m.samples.breathing.length > MARKER_MAX_SAMPLES) m.samples.breathing.shift();
  if (m.samples.gsr.length > MARKER_MAX_SAMPLES) m.samples.gsr.shift();

  const answerLen = state.lastAnswer.length;
  if (answerLen > 0 && state.answerProgress >= answerLen) {
    finalizeMarkerCapture();
  }
}

export function resetRun() {
  const config = state.gameData.system_config;
  state.maxFearBar = config.max_fear_bar;
  state.fearBar = config.initial_fear_bar;
  state.fearBarDisplay = config.initial_fear_bar;
  state.fearFlash = 0;
  state.topLog = [];
  state.lastQuestion = '';
  state.lastAnswer = '';
  state.error = '';
  state.questionProgress = 0;
  state.answerProgress = 0;
  state.evidence = [];
  state.verdict = '';
  state.trueVerdict = state.gameData.true_verdict || '';
  state.interrogationOutcome = null;
  state.polygraphMarkers = [];
  state.markerCapture = null;
  resetBiometricsOnState(
    state,
    {
      heartRate: config.heart_rate_baseline,
      gsr: config.gsr_baseline,
    },
    state.gameData.dossier?.modifiers
  );
  pushLog(state.gameData.context);
  return setNode(state.gameData.start_node);
}

const STRESS_TIER = {
  heartRate: {
    MAX_SPIKE: 3,
    SPIKE: 2,
    MAX: 3,
    ERRATIC: 2,
    INCREASE: 1,
    RISE: 1,
  },
  gsr: {
    MAX: 3,
    SURGE: 3,
    SPIKE: 2,
    INCREASE: 1,
  },
  breathing: {
    HOLDING_BREATH: 3,
    HYPERVENTILATION: 3,
    CRYING: 3,
    UNEVEN: 2,
    SHALLOW: 2,
  },
};

function classifyDeception(mechanics) {
  const hr = STRESS_TIER.heartRate[mechanics.heart_rate] || 0;
  const gsr = STRESS_TIER.gsr[mechanics.gsr] || 0;
  const breathing = STRESS_TIER.breathing[mechanics.breathing] || 0;
  const score = hr + gsr + breathing;
  return { score, hr, gsr, breathing };
}

export function pickChoice(index) {
  if (!state.currentNode || state.responseMode || state.currentNode.is_end_state) {
    return false;
  }

  const choice = state.currentNode.choices?.[index];
  if (!choice) {
    return false;
  }

  const mechanics = choice.mechanics || {};

  state.prompt = `${t('DIALOGUE_YOU_PREFIX')}${choice.question}`;
  state.lastQuestion = choice.question;
  state.lastAnswer = choice.answer;
  pushLog(`${t('DIALOGUE_YOU_PREFIX')}${choice.question}`);
  pushLog(`${getSuspectLabel()}: ${choice.answer}`);
  state.note = '';

  const deception = classifyDeception(mechanics);
  state.evidence.push({
    nodeId: state.currentNodeId,
    theme: state.currentNode.theme,
    choiceType: choice.type,
    question: choice.question,
    answer: choice.answer,
    heartRate: mechanics.heart_rate || 'BASELINE',
    breathing: mechanics.breathing || 'BASELINE',
    gsr: mechanics.gsr || 'BASELINE',
    fearDelta: mechanics.korku_bari_delta || 0,
    score: deception.score,
  });

  state.markerCapture = {
    qIndex: state.evidence.length,
    startTime: state.time,
    peakHr: 0,
    peakBreathing: 0,
    peakGsr: 0,
    hrCategory: mechanics.heart_rate || 'BASELINE',
    breathingCategory: mechanics.breathing || 'BASELINE',
    gsrCategory: mechanics.gsr || 'BASELINE',
    sampleAccum: 0,
    samples: { hr: [], breathing: [], gsr: [] },
  };

  state.metrics.heartRate = mechanics.heart_rate || state.metrics.heartRate;
  state.metrics.gsr = mechanics.gsr || state.metrics.gsr;
  state.metrics.breathing = mechanics.breathing || state.metrics.breathing;
  state.metrics.cctvVisual = mechanics.cctv_visual || state.metrics.cctvVisual;

  const prevFear = state.fearBar;
  state.fearBar = clamp(state.fearBar + (mechanics.korku_bari_delta || 0), 0, state.maxFearBar);
  if (state.fearBar !== prevFear) {
    state.fearFlash = 1;
  }
  applyMechanicsToBiometrics(state, mechanics);

  state.responseMode = true;
  state.responseTimer = 1.2;
  state.pendingNodeId = choice.next_node;
  state.questionProgress = 0;
  state.answerProgress = 0;

  return true;
}
