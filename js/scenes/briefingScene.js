import { registerScene, setScene } from '../sceneManager.js';
import { wasKeyPressed, wasMousePressed } from '../input.js';
import { drawRect, drawText, drawWrappedText } from '../draw.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawPanel } from '../ui/panel.js';
import { drawPolygraph } from '../ui/polygraph.js';
import { drawPortraitBadge } from '../ui/portraitBadge.js';
import { classifyCctv } from '../ui/cctvEffect.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { t } from '../i18n/index.js';
import { getBiometricDrawData, resetBiometricsOnState, updateWave } from '../game/waves.js';
import { applyAmbientProfile } from '../interrogationAudio.js';
import { clamp } from '../math.js';

const sandbox = {
  biometric: null,
  wave: {
    heartRate: { amp: 0.25, freq: 1.5, noise: 0.04 },
    gsr: { amp: 0.2, freq: 0.8, noise: 0.03 },
  },
  time: 0,
};

const SIGNAL_CYCLES = {
  pulse: [
    { mechanics: { heart_rate: 'BASELINE' } },
    { mechanics: { heart_rate: 'INCREASE' } },
    { mechanics: { heart_rate: 'SPIKE' } },
    { mechanics: { heart_rate: 'MAX_SPIKE' } },
  ],
  breathing: [
    { mechanics: { breathing: 'BASELINE' } },
    { mechanics: { breathing: 'SHALLOW' } },
    { mechanics: { breathing: 'HOLDING_BREATH' } },
    { mechanics: { breathing: 'HYPERVENTILATION' } },
    { mechanics: { breathing: 'CRYING' } },
  ],
  gsr: [
    { mechanics: { gsr: 'BASELINE' } },
    { mechanics: { gsr: 'INCREASE' } },
    { mechanics: { gsr: 'SPIKE' } },
    { mechanics: { gsr: 'SURGE' } },
    { mechanics: { gsr: 'MAX' } },
  ],
  fear: [{ fearDelta: 0 }, { fearDelta: 14 }, { fearDelta: 28 }, { fearDelta: -22 }],
  cctv: [
    { cue: 'STONE_FACE' },
    { cue: 'EYE_DART' },
    { cue: 'JAW_TIGHTEN' },
    { cue: 'DEFENSIVE_CROSS_ARMS' },
    { cue: 'BREAKDOWN' },
    { cue: 'TEAR_POOLING' },
    { cue: 'RELIEVED_EXHALE' },
  ],
};

const STEPS = ['intro', 'pulse', 'breathing', 'gsr', 'fear', 'cctv', 'modifiers', 'close'];

const PULSE_STATES = {
  BASELINE: { excite: 0, arousal: 0.22, pain: 0.02 },
  INCREASE: { excite: 0.55, arousal: 0.55, pain: 0.08 },
  SPIKE: { excite: 0.88, arousal: 0.82, pain: 0.22 },
  MAX_SPIKE: { excite: 1, arousal: 0.97, pain: 0.5 },
};

const GSR_STATES = {
  BASELINE: { tonic: 0.22, amp: 0.04, interval: 0 },
  INCREASE: { tonic: 0.4, amp: 0.18, interval: 1.6 },
  SPIKE: { tonic: 0.55, amp: 0.35, interval: 1.2 },
  SURGE: { tonic: 0.72, amp: 0.5, interval: 1 },
  MAX: { tonic: 0.9, amp: 0.7, interval: 0.8 },
};

let stepIndex = 0;
let cycleIndex = 0;
let gsrEmitTimer = 0;
let demoFearBar = 20;
let demoFearDisplay = 20;
let demoFearFlash = 0;
let laneFlash = { heartRate: 0, breathing: 0, gsr: 0 };

function resetSandbox() {
  resetBiometricsOnState(sandbox, { heartRate: 70, gsr: 6.5 }, null);
  sandbox.time = 0;
  demoFearBar = 20;
  demoFearDisplay = 20;
  demoFearFlash = 0;
  gsrEmitTimer = 0;
  laneFlash.heartRate = 0;
  laneFlash.breathing = 0;
  laneFlash.gsr = 0;
}

function refillGsrBuffer(tonic) {
  const bio = sandbox.biometric;
  const buf = bio?.buffers?.gsr;
  if (!buf) return;
  const size = buf.size;
  const data = new Float32Array(size);
  data.fill(tonic);
  bio.buffers.gsr = { data, size, count: size, head: 0 };
}

function activeCycle() {
  return SIGNAL_CYCLES[STEPS[stepIndex]] || null;
}

function enterStep(idx) {
  stepIndex = clamp(idx, 0, STEPS.length - 1);
  cycleIndex = 0;
  resetSandbox();
  applyCurrentCycle(true);
}

function advanceCycle() {
  const cycle = activeCycle();
  if (!cycle) return;
  cycleIndex = (cycleIndex + 1) % cycle.length;
  applyCurrentCycle(false);
}

function applyCurrentCycle(isEnter) {
  const step = STEPS[stepIndex];
  const entry = currentCycleEntry();
  if (!entry) return;

  if (step === 'pulse') {
    const name = entry.mechanics?.heart_rate || 'BASELINE';
    const s = PULSE_STATES[name] || PULSE_STATES.BASELINE;
    sandbox.biometric.transient.heartExcite = s.excite;
    sandbox.biometric.latent.arousal = s.arousal;
    sandbox.biometric.latent.painManipulation = s.pain;
    if (name === 'MAX_SPIKE') {
      sandbox.biometric.ecg.artifactBurst = clamp(
        sandbox.biometric.ecg.artifactBurst + 0.35,
        0,
        0.9
      );
    }
    laneFlash.heartRate = 1;
  } else if (step === 'breathing') {
    const name = entry.mechanics?.breathing || 'BASELINE';
    sandbox.biometric.breathing.state = name;
    sandbox.biometric.breathing.holdTimer = 0;
    laneFlash.breathing = 1;
  } else if (step === 'gsr') {
    const name = entry.mechanics?.gsr || 'BASELINE';
    const s = GSR_STATES[name] || GSR_STATES.BASELINE;
    sandbox.biometric.gsr.events.length = 0;
    sandbox.biometric.gsr.tonic = s.tonic;
    sandbox.biometric.baseline.gsrUs = 2 + s.tonic * 13.5;
    refillGsrBuffer(s.tonic);
    if (s.amp > 0.06) {
      sandbox.biometric.gsr.events.push({
        start: sandbox.biometric.time + 0.25,
        amp: s.amp,
        riseTau: 0.35,
        decayTau: 2.6,
      });
    }
    gsrEmitTimer = s.interval > 0 ? s.interval : 0;
    laneFlash.gsr = 1;
  } else if (step === 'fear' && entry.fearDelta != null) {
    const prev = demoFearBar;
    if (isEnter) {
      demoFearBar = 20;
      demoFearDisplay = 20;
    } else {
      demoFearBar = clamp(demoFearBar + entry.fearDelta, 0, 100);
    }
    if (demoFearBar !== prev) demoFearFlash = 1;
  }
}

function sustainTaughtLane(dt) {
  const step = STEPS[stepIndex];
  const entry = currentCycleEntry();
  if (!entry) return;

  if (step === 'pulse') {
    const name = entry.mechanics?.heart_rate || 'BASELINE';
    const s = PULSE_STATES[name] || PULSE_STATES.BASELINE;
    sandbox.biometric.transient.heartExcite = Math.max(
      sandbox.biometric.transient.heartExcite,
      s.excite
    );
    sandbox.biometric.latent.arousal = s.arousal;
    sandbox.biometric.latent.painManipulation = s.pain;
  } else if (step === 'gsr') {
    const name = entry.mechanics?.gsr || 'BASELINE';
    const s = GSR_STATES[name] || GSR_STATES.BASELINE;
    sandbox.biometric.gsr.tonic += (s.tonic - sandbox.biometric.gsr.tonic) * Math.min(1, dt * 1.4);
    if (s.interval > 0) {
      gsrEmitTimer -= dt;
      if (gsrEmitTimer <= 0) {
        sandbox.biometric.gsr.events.push({
          start: sandbox.biometric.time + 0.2,
          amp: s.amp,
          riseTau: 0.35,
          decayTau: 2.4,
        });
        gsrEmitTimer = s.interval;
      }
    }
  }
}

function currentCycleEntry() {
  const cycle = activeCycle();
  if (!cycle) return null;
  return cycle[cycleIndex];
}

function currentStateLabel() {
  const entry = currentCycleEntry();
  if (!entry) return '';
  if (entry.mechanics) {
    return entry.mechanics.heart_rate || entry.mechanics.breathing || entry.mechanics.gsr || '';
  }
  if (entry.cue) return entry.cue;
  if (entry.fearDelta != null) {
    return entry.fearDelta > 0 ? `+${entry.fearDelta}` : String(entry.fearDelta);
  }
  return '';
}

function stepKey(key) {
  const name = STEPS[stepIndex].toUpperCase();
  return t(`BRIEFING_${name}_${key}`);
}

function drawHeader(ctx) {
  drawText(ctx, t('BRIEFING_TITLE'), DESIGN_W / 2, 22, {
    size: 18,
    color: COLORS.amberBright,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });

  const total = STEPS.length;
  const dotY = 38;
  const dotGap = 10;
  const totalW = (total - 1) * dotGap;
  const dotStartX = DESIGN_W / 2 - totalW / 2;
  for (let i = 0; i < total; i += 1) {
    const x = dotStartX + i * dotGap;
    const active = i === stepIndex;
    drawRect(ctx, x - 2, dotY - 2, 4, 4, active ? COLORS.amberBright : COLORS.amberDim);
  }
}

function drawTextPanel(ctx, y, h) {
  const panelX = 28;
  const panelW = DESIGN_W - 56;
  drawPanel(ctx, panelX, y, panelW, h, { border: COLORS.amberDim });

  drawText(ctx, stepKey('TITLE'), panelX + 14, y + 18, {
    size: 14,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawWrappedText(ctx, stepKey('BODY'), panelX + 14, y + 36, panelW - 28, {
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
    lineHeight: 14,
    maxLines: 6,
  });

  const state = currentStateLabel();
  if (state) {
    const cycle = activeCycle();
    const suffix = cycle ? `  ${cycleIndex + 1}/${cycle.length}` : '';
    drawText(ctx, `${state}${suffix}`, panelX + panelW - 14, y + 18, {
      size: 12,
      color: COLORS.amberBright,
      align: 'right',
      font: UI_FONT,
      baseline: 'middle',
    });
  }
}

function drawPolygraphDemo(ctx) {
  drawPolygraph(ctx, 0, 290, 600, 110, {
    waves: sandbox.wave,
    time: sandbox.time,
    biometric: getBiometricDrawData(sandbox),
    fearBar: demoFearDisplay,
    maxFearBar: 100,
    fearFlash: demoFearFlash,
    laneFlash,
    markers: [],
    activeMarker: null,
  });
}

function drawCctvDemo(ctx) {
  const badgeW = 110;
  const badgeH = 96;
  const x = DESIGN_W / 2 - badgeW / 2;
  const y = 210;
  const entry = currentCycleEntry();
  const cue = entry?.cue || 'STONE_FACE';
  const style = classifyCctv(cue);
  drawPortraitBadge(ctx, x, y, badgeW, badgeH, 'defendant', cue, {
    style,
    intensity: 1,
    time: sandbox.time,
  });
}

function drawFooter(ctx) {
  const parts = [
    `${stepIndex + 1} / ${STEPS.length}`,
    t('BRIEFING_HINT_NEXT'),
    t('BRIEFING_HINT_BACK'),
  ];
  if (activeCycle()) {
    parts.push(t('BRIEFING_HINT_STATE'));
  }
  parts.push(t('BRIEFING_HINT_EXIT'));
  drawText(ctx, parts.join('  ·  '), DESIGN_W / 2, DESIGN_H - 16, {
    size: 10,
    color: COLORS.creamDim,
    align: 'center',
    font: UI_FONT,
    baseline: 'middle',
  });
}

function drawBriefingScene(ctx) {
  drawSceneBackground(ctx);
  drawRect(ctx, 0, 0, DESIGN_W, DESIGN_H, 'rgba(0,0,0,0.55)');

  drawHeader(ctx);

  const step = STEPS[stepIndex];
  if (step === 'cctv') {
    drawTextPanel(ctx, 56, 140);
    drawCctvDemo(ctx);
  } else if (step === 'intro' || step === 'modifiers' || step === 'close') {
    drawTextPanel(ctx, 56, 240);
  } else {
    drawTextPanel(ctx, 56, 220);
    drawPolygraphDemo(ctx);
  }

  drawFooter(ctx);
}

export function registerBriefingScene(_canvas, ctx) {
  registerScene('briefing', {
    enter() {
      resetSandbox();
      stepIndex = 0;
      enterStep(0);
      applyAmbientProfile('menu');
    },
    update(dt) {
      sandbox.time += dt;
      sustainTaughtLane(dt);
      updateWave(sandbox, dt);

      const fearDiff = demoFearBar - demoFearDisplay;
      demoFearDisplay += fearDiff * Math.min(1, dt * 6);
      demoFearFlash = Math.max(0, demoFearFlash - dt * 2);
      laneFlash.heartRate = Math.max(0, laneFlash.heartRate - dt * 1.8);
      laneFlash.breathing = Math.max(0, laneFlash.breathing - dt * 1.8);
      laneFlash.gsr = Math.max(0, laneFlash.gsr - dt * 1.8);

      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }
      if (wasKeyPressed(' ')) {
        if (activeCycle()) {
          advanceCycle();
          return;
        }
      }
      if (
        wasKeyPressed('enter') ||
        wasKeyPressed('arrowright') ||
        wasKeyPressed('d') ||
        wasMousePressed(0)
      ) {
        if (stepIndex >= STEPS.length - 1) {
          setScene('menu');
          return;
        }
        enterStep(stepIndex + 1);
        return;
      }
      if (wasKeyPressed('arrowleft') || wasKeyPressed('a')) {
        if (stepIndex > 0) {
          enterStep(stepIndex - 1);
        }
        return;
      }
    },
    render() {
      drawBriefingScene(ctx);
    },
  });
}
