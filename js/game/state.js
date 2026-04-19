import { clamp } from '../math.js';
import { CASES } from './cases.js';
import { applyMechanicsToBiometrics, resetBiometricsOnState } from './waves.js';

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
  metrics: {
    heartRate: 'BASELINE',
    eeg: 'BASELINE',
    gsr: 'BASELINE',
    breathing: 'BASELINE',
    cctvVisual: 'NEUTRAL',
  },
  wave: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    eeg: { amp: 0.35, freq: 2.4, noise: 0.07 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  waveTarget: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    eeg: { amp: 0.35, freq: 2.4, noise: 0.07 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  time: 0,
};

export function getSuspectLabel() {
  const name = state.gameData?.suspect?.name;
  return name ? String(name).toUpperCase() : 'DEFENDANT';
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

export function setNode(nodeId) {
  const node = state.gameData.nodes[nodeId];
  if (!node) {
    state.error = `Node not found: ${nodeId}`;
    state.currentNode = null;
    return { ok: false, isEnd: true };
  }

  state.currentNodeId = nodeId;
  state.currentNode = node;
  state.responseMode = false;
  state.responseTimer = 0;
  state.pendingNodeId = '';
  state.prompt = '';
  state.choiceRects = [];

  return { ok: true, isEnd: !!node.is_end_state };
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
  resetBiometricsOnState(state, {
    heartRate: config.heart_rate_baseline,
    eeg: config.eeg_baseline,
    gsr: config.gsr_baseline,
  });
  pushLog(state.gameData.context);
  return setNode(state.gameData.start_node);
}

const STRESS_TIER = {
  heartRate: {
    MAX_SPIKE: 3, SPIKE: 2, MAX: 3, ERRATIC: 2, INCREASE: 1, RISE: 1,
  },
  gsr: {
    MAX: 3, SURGE: 3, SPIKE: 2, INCREASE: 1,
  },
  eeg: {
    FLATLINE: 3, CHAOTIC: 3, ERRATIC: 2, INCREASE: 1,
  },
};

function classifyDeception(mechanics) {
  const hr = STRESS_TIER.heartRate[mechanics.heart_rate] || 0;
  const gsr = STRESS_TIER.gsr[mechanics.gsr] || 0;
  const eeg = STRESS_TIER.eeg[mechanics.eeg] || 0;
  const score = hr + gsr + eeg;
  return { score, hr, gsr, eeg };
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
  state.prompt = `SEN: ${choice.question}`;
  state.lastQuestion = choice.question;
  state.lastAnswer = choice.answer;
  pushLog(`SEN: ${choice.question}`);
  pushLog(`${getSuspectLabel()}: ${choice.answer}`);
  state.note = '';

  const deception = classifyDeception(mechanics);
  state.evidence.push({
    nodeId: state.currentNodeId,
    theme: state.currentNode.theme,
    choiceType: choice.type,
    question: choice.question,
    heartRate: mechanics.heart_rate || 'BASELINE',
    eeg: mechanics.eeg || 'BASELINE',
    gsr: mechanics.gsr || 'BASELINE',
    fearDelta: mechanics.korku_bari_delta || 0,
    score: deception.score,
  });

  state.metrics.heartRate = mechanics.heart_rate || state.metrics.heartRate;
  state.metrics.eeg = mechanics.eeg || state.metrics.eeg;
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
