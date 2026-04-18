import { clamp } from '../math.js';

const WINDOW_SECONDS = 8;
const SAMPLE_RATE = {
  heartRate: 256,
  eeg: 256,
  gsr: 64,
};

const RELAX_BASELINE = {
  arousal: 0.24,
  cognitiveLoad: 0.26,
  painManipulation: 0.04,
  fatigue: 0.18,
  control: 0.58,
};

const METRIC_TO_DELTA = {
  BASELINE: { arousal: -0.06, cognitive: -0.04, pain: -0.1, control: 0.06, fatigue: 0.01 },
  DROP: { arousal: -0.2, cognitive: -0.08, pain: -0.1, control: 0.1, fatigue: 0.02 },
  DECREASE: { arousal: -0.14, cognitive: -0.06, pain: -0.08, control: 0.07, fatigue: 0.02 },
  INCREASE: { arousal: 0.16, cognitive: 0.14, pain: 0.05, control: -0.08, fatigue: 0.02 },
  SPIKE: { arousal: 0.28, cognitive: 0.18, pain: 0.1, control: -0.14, fatigue: 0.03 },
  ERRATIC: { arousal: 0.36, cognitive: 0.28, pain: 0.16, control: -0.22, fatigue: 0.04 },
  MAX_SPIKE: { arousal: 0.5, cognitive: 0.24, pain: 0.24, control: -0.28, fatigue: 0.05 },
  MAX: { arousal: 0.55, cognitive: 0.2, pain: 0.34, control: -0.32, fatigue: 0.06 },
  CHAOTIC: { arousal: 0.18, cognitive: 0.48, pain: 0.1, control: -0.2, fatigue: 0.05 },
  FLATLINE: { arousal: -0.08, cognitive: -0.45, pain: 0.34, control: -0.08, fatigue: 0.1 },
};

function createRingBuffer(rate) {
  const size = Math.floor(rate * WINDOW_SECONDS);
  return {
    data: new Float32Array(size),
    size,
    count: 0,
    head: 0,
  };
}

function pushRing(buffer, value) {
  buffer.data[buffer.head] = value;
  buffer.head = (buffer.head + 1) % buffer.size;
  buffer.count = Math.min(buffer.count + 1, buffer.size);
}

function ringAtOffset(buffer, offset) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const clamped = clamp(offset, 0, buffer.count - 1);
  const idx = (buffer.head - 1 - clamped + buffer.size * 4) % buffer.size;
  return buffer.data[idx];
}

function ringAtOffsetLerp(buffer, offsetFloat) {
  const lo = Math.floor(offsetFloat);
  const hi = Math.min(lo + 1, Math.max(0, buffer.count - 1));
  const t = offsetFloat - lo;
  const a = ringAtOffset(buffer, lo);
  const b = ringAtOffset(buffer, hi);
  return a + (b - a) * t;
}

function pseudoNoise(time, seed) {
  return (
    Math.sin(time * (1.17 + seed * 0.05) + seed * 7.3) * 0.57 +
    Math.sin(time * (2.51 + seed * 0.03) + seed * 4.1) * 0.29 +
    Math.sin(time * (6.23 + seed * 0.02) + seed * 2.7) * 0.14
  );
}

function gaussian(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

function ecgTemplate(phase) {
  const p = 0.12 * gaussian(phase, 0.18, 0.03);
  const q = -0.2 * gaussian(phase, 0.34, 0.012);
  const r = 1.4 * gaussian(phase, 0.37, 0.008);
  const s = -0.3 * gaussian(phase, 0.4, 0.014);
  const t = 0.3 * gaussian(phase, 0.63, 0.06);
  return p + q + r + s + t;
}

function createBiometricState() {
  return {
    time: 0,
    latent: {
      ...RELAX_BASELINE,
    },
    drive: {
      sympathetic: 0.26,
      parasympathetic: 0.54,
    },
    ecg: {
      bpm: 72,
      rr: 0.83,
      beatTime: 0,
      hrvLf: 0,
      hrvHf: 0,
      artifactBurst: 0,
      qrsGain: 1,
      twaveGain: 1,
    },
    eeg: {
      phase: { d: 0, t: 0, a: 0, b: 0, g: 0 },
      pink: 0,
      blink: 0,
      emg: 0,
    },
    gsr: {
      tonic: 0.26,
      events: [],
      eventCooldown: 0,
    },
    readout: {
      bpm: 72,
      eegUv: 24.5,
      gsrUs: 6.8,
    },
    baseline: {
      bpm: 72,
      eegUv: 24.5,
      gsrUs: 6.8,
    },
    buffers: {
      heartRate: createRingBuffer(SAMPLE_RATE.heartRate),
      eeg: createRingBuffer(SAMPLE_RATE.eeg),
      gsr: createRingBuffer(SAMPLE_RATE.gsr),
    },
    accum: {
      heart: 0,
      eeg: 0,
      gsr: 0,
    },
    transient: {
      heartExcite: 0,
      eegExcite: 0,
    },
  };
}

function applyDelta(latent, delta, weight = 1) {
  if (!delta) {
    return;
  }
  latent.arousal = clamp(latent.arousal + (delta.arousal || 0) * weight, 0, 1);
  latent.cognitiveLoad = clamp(latent.cognitiveLoad + (delta.cognitive || 0) * weight, 0, 1);
  latent.painManipulation = clamp(latent.painManipulation + (delta.pain || 0) * weight, 0, 1);
  latent.control = clamp(latent.control + (delta.control || 0) * weight, 0, 1);
  latent.fatigue = clamp(latent.fatigue + (delta.fatigue || 0) * weight, 0, 1);
}

function applyMechanicMetric(latent, metricValue, weight = 1) {
  applyDelta(latent, METRIC_TO_DELTA[metricValue], weight);
}

function normalizedMetric(value) {
  if (typeof value !== 'string') {
    return 'BASELINE';
  }
  const key = value.trim().toUpperCase();
  return METRIC_TO_DELTA[key] ? key : 'BASELINE';
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function triggerGsrEvent(model, intensity = 0.5) {
  const delay = 0.7 + Math.random() * 1.3;
  model.gsr.events.push({
    start: model.time + delay,
    amp: clamp(0.03 + intensity * 0.15, 0.02, 0.3),
    riseTau: 0.35,
    decayTau: 2.6,
  });
}

function updateLatentAndDrive(model, dt) {
  const { latent, drive } = model;

  const symTarget = clamp(
    0.08 +
      latent.arousal * 0.5 +
      latent.cognitiveLoad * 0.18 +
      latent.painManipulation * 0.24 -
      latent.control * 0.14,
    0,
    1
  );
  drive.sympathetic += (symTarget - drive.sympathetic) * Math.min(1, dt * 2.9);
  drive.parasympathetic += (1 - symTarget * 0.82 - drive.parasympathetic) * Math.min(1, dt * 1.8);

  latent.arousal += (RELAX_BASELINE.arousal - latent.arousal) * Math.min(1, dt * 0.2);
  latent.cognitiveLoad +=
    (RELAX_BASELINE.cognitiveLoad - latent.cognitiveLoad) * Math.min(1, dt * 0.17);
  latent.painManipulation +=
    (RELAX_BASELINE.painManipulation - latent.painManipulation) * Math.min(1, dt * 0.58);
  latent.fatigue += (RELAX_BASELINE.fatigue - latent.fatigue) * Math.min(1, dt * 0.1);
  latent.control += (RELAX_BASELINE.control - latent.control) * Math.min(1, dt * 0.26);

  model.transient.heartExcite = Math.max(0, model.transient.heartExcite - dt * 0.55);
  model.transient.eegExcite = Math.max(0, model.transient.eegExcite - dt * 0.7);
}

function updateEcgParams(model, dt) {
  const { ecg, drive, latent, time } = model;
  const baseBpm = model.baseline?.bpm ?? 72;
  const bpmTarget = clamp(
    baseBpm +
      (drive.sympathetic - 0.28) * 52 -
      (drive.parasympathetic - 0.54) * 18 +
      latent.painManipulation * 14,
    48,
    162
  );
  ecg.bpm += (bpmTarget - ecg.bpm) * Math.min(1, dt * 3.2);

  ecg.hrvLf = Math.sin(time * Math.PI * 2 * 0.1) * (0.02 + drive.parasympathetic * 0.02);
  ecg.hrvHf = Math.sin(time * Math.PI * 2 * 0.26 + 1.2) * (0.01 + drive.parasympathetic * 0.018);
  ecg.rr = clamp(60 / Math.max(ecg.bpm, 45) + ecg.hrvLf + ecg.hrvHf, 0.36, 1.4);

  const qrsTarget = clamp(
    0.9 + drive.sympathetic * 0.6 + latent.painManipulation * 0.22 - drive.parasympathetic * 0.1,
    0.75,
    1.85
  );
  const twaveTarget = clamp(
    0.95 + drive.sympathetic * 0.2 - latent.painManipulation * 0.15,
    0.7,
    1.35
  );
  ecg.qrsGain += (qrsTarget - ecg.qrsGain) * Math.min(1, dt * 2.6);
  ecg.twaveGain += (twaveTarget - ecg.twaveGain) * Math.min(1, dt * 2.2);

  if (latent.painManipulation > 0.4 && Math.random() < dt * 0.9) {
    ecg.artifactBurst = clamp(ecg.artifactBurst + 0.18, 0, 0.8);
  }
  ecg.artifactBurst = Math.max(0, ecg.artifactBurst - dt * 0.7);
}

function emitEcgSamples(model, dt) {
  model.accum.heart += dt;
  const step = 1 / SAMPLE_RATE.heartRate;
  let guard = 0;
  while (model.accum.heart >= step && guard < 1024) {
    guard += 1;
    model.accum.heart -= step;
    const t = model.time - model.accum.heart;

    model.ecg.beatTime += step;
    if (model.ecg.beatTime >= model.ecg.rr) {
      model.ecg.beatTime -= model.ecg.rr;
    }

    const phase = model.ecg.beatTime / model.ecg.rr;
    const base = ecgTemplate(phase);
    const shaped = base >= 0 ? base * model.ecg.qrsGain : base * (0.9 + model.ecg.qrsGain * 0.16);
    const baselineWander = Math.sin(t * Math.PI * 2 * 0.24) * 0.035;
    const emg = pseudoNoise(t * 7.3, 21) * (0.01 + model.latent.arousal * 0.02);
    const hum = Math.sin(t * Math.PI * 2 * 50) * 0.005;
    const motion = pseudoNoise(t * 3.2, 33) * model.ecg.artifactBurst * 0.06;
    const exciteGain = 1 + model.transient.heartExcite * 0.85;
    const sample = (shaped * exciteGain + baselineWander + emg + hum + motion) * 0.9;
    pushRing(model.buffers.heartRate, sample);
  }

  model.readout.bpm += (model.ecg.bpm - model.readout.bpm) * 0.22;
}

function emitEegSamples(model, dt) {
  model.accum.eeg += dt;
  const step = 1 / SAMPLE_RATE.eeg;
  let guard = 0;
  while (model.accum.eeg >= step && guard < 2048) {
    guard += 1;
    model.accum.eeg -= step;
    const t = model.time - model.accum.eeg;

    const stress = model.drive.sympathetic;
    const cLoad = model.latent.cognitiveLoad;

    const ampDelta = 0.16 + model.latent.fatigue * 0.22;
    const ampTheta = 0.2 + model.latent.fatigue * 0.25 + (1 - model.latent.control) * 0.1;
    const ampAlpha = clamp(0.38 - stress * 0.22 - cLoad * 0.12, 0.08, 0.45);
    const ampBeta = clamp(0.18 + stress * 0.36 + cLoad * 0.3, 0.12, 0.85);
    const ampGamma = clamp(0.05 + cLoad * 0.16 + stress * 0.08, 0.02, 0.28);

    model.eeg.phase.d += Math.PI * 2 * 2.2 * step;
    model.eeg.phase.t += Math.PI * 2 * 5.8 * step;
    model.eeg.phase.a += Math.PI * 2 * 9.8 * step;
    model.eeg.phase.b += Math.PI * 2 * 19.5 * step;
    model.eeg.phase.g += Math.PI * 2 * 34 * step;

    const delta = Math.sin(model.eeg.phase.d) * ampDelta;
    const theta = Math.sin(model.eeg.phase.t + 0.9) * ampTheta;
    const alpha = Math.sin(model.eeg.phase.a + 0.4) * ampAlpha;
    const beta = Math.sin(model.eeg.phase.b + 1.1) * ampBeta;
    const gamma = Math.sin(model.eeg.phase.g + 0.2) * ampGamma;

    const white = (Math.random() * 2 - 1) * 0.1;
    model.eeg.pink = model.eeg.pink * 0.985 + white * 0.09;

    const emgTarget = clamp(stress * 0.22 + model.latent.painManipulation * 0.3, 0, 0.6);
    model.eeg.emg += (emgTarget - model.eeg.emg) * 0.08;
    const emg = pseudoNoise(t * 18.3, 44) * model.eeg.emg * 0.22;
    const line = Math.sin(t * Math.PI * 2 * 50) * 0.02;

    if (Math.random() < step * (0.15 + (1 - model.latent.control) * 0.45)) {
      model.eeg.blink = clamp(model.eeg.blink + 0.7, 0, 1.6);
    }
    model.eeg.blink *= 0.93;
    const blinkArtifact = model.eeg.blink * 0.23;

    const exciteGain = 1 + model.transient.eegExcite * 1.15;
    const sample =
      (delta + theta + alpha + beta + gamma + model.eeg.pink + emg + line + blinkArtifact) *
      0.26 *
      exciteGain;
    pushRing(model.buffers.eeg, sample);
  }

  const rms = rmsRecent(model.buffers.eeg, SAMPLE_RATE.eeg, 1.2);
  const uvFromRms = clamp(16 + rms * 130, 9, 95);
  const baseUv = model.baseline?.eegUv ?? 24.5;
  const uvDrift = (uvFromRms - 26) * 0.72 + (model.drive.sympathetic - 0.3) * 6;
  const uv = clamp(baseUv + uvDrift + model.transient.eegExcite * 7, 8, 120);
  model.readout.eegUv += (uv - model.readout.eegUv) * 0.18;
}

function emitGsrSamples(model, dt) {
  model.accum.gsr += dt;
  const step = 1 / SAMPLE_RATE.gsr;
  const stress = model.drive.sympathetic;
  const baseTonic = clamp(((model.baseline?.gsrUs ?? 6.8) - 2) / 13.5, 0.08, 1.1);
  const tonicTarget = clamp(
    baseTonic + (stress - 0.3) * 0.28 + model.latent.fatigue * 0.05,
    0.08,
    1.1
  );
  model.gsr.tonic += (tonicTarget - model.gsr.tonic) * Math.min(1, dt * 0.7);
  model.gsr.eventCooldown = Math.max(0, model.gsr.eventCooldown - dt);

  if (stress > 0.52 && model.gsr.eventCooldown <= 0 && Math.random() < dt * 0.8) {
    triggerGsrEvent(model, stress);
    model.gsr.eventCooldown = 0.65 + Math.random() * 1.2;
  }

  let guard = 0;
  while (model.accum.gsr >= step && guard < 512) {
    guard += 1;
    model.accum.gsr -= step;
    const tNow = model.time - model.accum.gsr;

    let phasic = 0;
    for (let i = model.gsr.events.length - 1; i >= 0; i -= 1) {
      const ev = model.gsr.events[i];
      const t = tNow - ev.start;
      if (t < 0) {
        continue;
      }
      const value = ev.amp * (Math.exp(-t / ev.decayTau) - Math.exp(-t / ev.riseTau));
      phasic += Math.max(0, value);
      if (t > 8) {
        model.gsr.events.splice(i, 1);
      }
    }

    const drift = pseudoNoise(tNow * 0.15, 73) * 0.008;
    const motion = pseudoNoise(tNow * 0.8, 89) * model.latent.painManipulation * 0.01;
    const sample = clamp(model.gsr.tonic + phasic + drift + motion, 0.02, 1.4);
    pushRing(model.buffers.gsr, sample);
  }

  const latest = ringAtOffset(model.buffers.gsr, 0);
  const us = clamp(2 + latest * 13.5, 1.5, 22);
  model.readout.gsrUs += (us - model.readout.gsrUs) * 0.16;
}

function rmsRecent(buffer, sampleRate, seconds) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const n = Math.max(1, Math.min(buffer.count, Math.floor(seconds * sampleRate)));
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const v = ringAtOffset(buffer, i);
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

function syncLegacyWave(state) {
  const heart = Math.abs(ringAtOffset(state.biometric.buffers.heartRate, 0));
  const eeg = Math.abs(ringAtOffset(state.biometric.buffers.eeg, 0));
  const gsr = Math.abs(ringAtOffset(state.biometric.buffers.gsr, 0));

  state.wave.heartRate.amp = clamp(0.05 + heart * 0.82, 0.02, 1);
  state.wave.eeg.amp = clamp(0.08 + eeg * 1.3, 0.02, 1);
  state.wave.gsr.amp = clamp(0.04 + gsr * 0.45, 0.02, 1);

  state.wave.heartRate.freq = clamp(state.biometric.readout.bpm / 55, 0.6, 3.8);
  state.wave.eeg.freq = clamp(1.2 + state.biometric.latent.cognitiveLoad * 4.5, 1, 6.6);
  state.wave.gsr.freq = clamp(0.35 + state.biometric.drive.sympathetic * 0.8, 0.35, 1.8);

  state.wave.heartRate.noise = clamp(
    0.015 + state.biometric.latent.painManipulation * 0.12,
    0.01,
    0.2
  );
  state.wave.eeg.noise = clamp(0.03 + state.biometric.eeg.emg * 0.2, 0.02, 0.3);
  state.wave.gsr.noise = clamp(0.006 + state.biometric.latent.painManipulation * 0.04, 0.005, 0.09);
}

function warmupModel(model, seconds = 4) {
  const dt = 1 / 60;
  const steps = Math.floor(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    model.time += dt;
    updateLatentAndDrive(model, dt);
    updateEcgParams(model, dt);
    emitEcgSamples(model, dt);
    emitEegSamples(model, dt);
    emitGsrSamples(model, dt);
  }
}

function applyBaselineMetricsToModel(model, baseline = {}) {
  const latent = model.latent;

  const heartNumeric = toFiniteNumber(baseline.heartRate);
  const eegNumeric = toFiniteNumber(baseline.eeg);
  const gsrNumeric = toFiniteNumber(baseline.gsr);

  if (heartNumeric !== null || eegNumeric !== null || gsrNumeric !== null) {
    const bpm = clamp(heartNumeric ?? 72, 48, 170);
    const eegUv = clamp(eegNumeric ?? 24.5, 8, 120);
    const gsrUs = clamp(gsrNumeric ?? 6.8, 1.5, 25);

    model.ecg.bpm = bpm;
    model.ecg.rr = clamp(60 / bpm, 0.36, 1.4);
    model.readout.bpm = bpm;
    model.baseline.bpm = bpm;

    const eegNorm = (eegUv - 8) / (120 - 8);
    model.eeg.phase = { d: 0, t: 0, a: 0, b: 0, g: 0 };
    model.eeg.pink = 0;
    model.eeg.blink = 0;
    model.eeg.emg = clamp(0.04 + eegNorm * 0.14, 0, 0.4);
    model.readout.eegUv = eegUv;
    model.baseline.eegUv = eegUv;

    const gsrNorm = (gsrUs - 1.5) / (25 - 1.5);
    model.gsr.tonic = clamp((gsrUs - 2) / 13.5, 0.08, 1.1);
    model.readout.gsrUs = gsrUs;
    model.baseline.gsrUs = gsrUs;

    latent.arousal = clamp(0.16 + gsrNorm * 0.52 + (bpm - 55) / 140, 0, 1);
    latent.cognitiveLoad = clamp(0.2 + eegNorm * 0.42, 0, 1);
    latent.painManipulation = clamp(0.02 + gsrNorm * 0.08, 0, 1);
    latent.control = clamp(0.7 - eegNorm * 0.22, 0, 1);
    latent.fatigue = clamp(0.1 + (1 - eegNorm) * 0.22, 0, 1);
  } else {
    const heart = normalizedMetric(baseline.heartRate);
    const eeg = normalizedMetric(baseline.eeg);
    const gsr = normalizedMetric(baseline.gsr);
    applyMechanicMetric(latent, heart, 0.6);
    applyMechanicMetric(latent, eeg, 0.66);
    applyMechanicMetric(latent, gsr, 0.54);
    model.baseline.bpm = model.readout.bpm;
    model.baseline.eegUv = model.readout.eegUv;
    model.baseline.gsrUs = model.readout.gsrUs;
  }

  for (let i = 0; i < 180; i += 1) {
    const dt = 1 / 60;
    model.time += dt;
    updateLatentAndDrive(model, dt);
    updateEcgParams(model, dt);
    emitEcgSamples(model, dt);
    emitEegSamples(model, dt);
    emitGsrSamples(model, dt);
  }
}

export function initBiometricsOnState(state, baseline) {
  state.biometric = createBiometricState();
  warmupModel(state.biometric, 4);
  applyBaselineMetricsToModel(state.biometric, baseline);
}

export function resetBiometricsOnState(state, baseline) {
  state.biometric = createBiometricState();
  warmupModel(state.biometric, 4);
  applyBaselineMetricsToModel(state.biometric, baseline);
  syncLegacyWave(state);
}

export function applyMechanicsToBiometrics(state, mechanics) {
  if (!state.biometric) {
    state.biometric = createBiometricState();
    warmupModel(state.biometric, 2);
  }

  const latent = state.biometric.latent;
  applyMechanicMetric(latent, mechanics.heart_rate, 0.84);
  applyMechanicMetric(latent, mechanics.eeg, 0.92);
  applyMechanicMetric(latent, mechanics.gsr, 0.72);

  const heartExciteMap = {
    DROP: 0,
    DECREASE: 0.08,
    BASELINE: 0.12,
    INCREASE: 0.35,
    SPIKE: 0.62,
    ERRATIC: 0.78,
    MAX_SPIKE: 0.95,
    MAX: 1,
  };
  const eegExciteMap = {
    DROP: 0,
    BASELINE: 0.16,
    INCREASE: 0.48,
    CHAOTIC: 0.92,
    FLATLINE: 0.05,
  };
  state.biometric.transient.heartExcite = Math.max(
    state.biometric.transient.heartExcite,
    heartExciteMap[mechanics.heart_rate] ?? 0.2
  );
  state.biometric.transient.eegExcite = Math.max(
    state.biometric.transient.eegExcite,
    eegExciteMap[mechanics.eeg] ?? 0.2
  );

  const breathingMap = {
    BASELINE: { arousal: -0.03, control: 0.03 },
    DEEP: { arousal: -0.17, control: 0.15, cognitive: -0.05 },
    SHALLOW: { arousal: 0.16, control: -0.08, cognitive: 0.06 },
    HOLDING_BREATH: { arousal: 0.2, pain: 0.2, control: -0.08 },
    HYPERVENTILATION: { arousal: 0.32, cognitive: 0.12, control: -0.18 },
    CRYING: { arousal: 0.2, control: -0.24, fatigue: 0.08, cognitive: -0.05 },
  };
  applyDelta(latent, breathingMap[mechanics.breathing], 1);

  const cctvMap = {
    EYE_DART: { arousal: 0.19, cognitive: 0.22, control: -0.11 },
    LOOK_DOWN: { arousal: 0.11, control: -0.11, fatigue: 0.05 },
    RELIEVED_EXHALE: { arousal: -0.18, control: 0.16 },
    HAND_PINCH_UNDER_TABLE: { pain: 0.38, arousal: 0.16, cognitive: 0.05 },
    DEFENSIVE_CROSS_ARMS: { control: 0.18, cognitive: -0.12, arousal: -0.05 },
    BREAKDOWN: { control: -0.35, arousal: 0.22, fatigue: 0.13 },
    STONE_FACE: { control: 0.23, cognitive: -0.14, arousal: -0.04 },
    EMPTY_STARE: { control: -0.18, cognitive: -0.3, fatigue: 0.18 },
    JAW_TIGHTEN: { arousal: 0.18, pain: 0.07, control: -0.06 },
    RELEASED_SHOULDERS: { arousal: -0.22, control: 0.19, cognitive: -0.08 },
    LIP_PRESS: { arousal: 0.12, cognitive: 0.16, control: -0.1 },
    TEAR_POOLING: { control: -0.22, fatigue: 0.11, arousal: 0.14 },
  };
  applyDelta(latent, cctvMap[mechanics.cctv_visual], 1);

  triggerGsrEvent(
    state.biometric,
    clamp(0.25 + latent.arousal * 0.55 + latent.cognitiveLoad * 0.38, 0.1, 1)
  );
  if (latent.painManipulation > 0.36) {
    state.biometric.ecg.artifactBurst = clamp(state.biometric.ecg.artifactBurst + 0.2, 0, 0.9);
  }
}

export function updateWave(state, dt) {
  if (!state.biometric) {
    initBiometricsOnState(state);
  }

  const model = state.biometric;
  model.time += dt;
  updateLatentAndDrive(model, dt);
  updateEcgParams(model, dt);
  emitEcgSamples(model, dt);
  emitEegSamples(model, dt);
  emitGsrSamples(model, dt);
  syncLegacyWave(state);
}

export function getBiometricDrawData(state) {
  if (!state.biometric) {
    initBiometricsOnState(state);
  }
  return {
    sampleRate: SAMPLE_RATE,
    buffers: state.biometric.buffers,
    readout: state.biometric.readout,
    sampleAt: (metric, offsetFloat) =>
      ringAtOffsetLerp(state.biometric.buffers[metric], offsetFloat),
  };
}
