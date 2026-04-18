export function metricStyle(metric, value) {
  const base = {
    amp: 0.2,
    freq: 1.4,
    noise: 0.04,
  };

  const map = {
    BASELINE: { amp: 0.2, freq: 1.3, noise: 0.03 },
    DROP: { amp: 0.12, freq: 1.0, noise: 0.02 },
    DECREASE: { amp: 0.14, freq: 1.1, noise: 0.03 },
    INCREASE: { amp: 0.35, freq: 1.7, noise: 0.06 },
    SPIKE: { amp: 0.5, freq: 2.2, noise: 0.08 },
    MAX_SPIKE: { amp: 0.82, freq: 2.8, noise: 0.09 },
    ERRATIC: { amp: 0.72, freq: 3.2, noise: 0.12 },
    MAX: { amp: 0.9, freq: 2.9, noise: 0.1 },
    FLATLINE: { amp: 0.02, freq: 0.5, noise: 0.008 },
    CHAOTIC: { amp: 0.8, freq: 3.8, noise: 0.14 },
  };

  const style = map[value] || base;
  if (metric === "gsr") {
    return {
      amp: style.amp * 0.7,
      freq: Math.max(0.35, style.freq * 0.45),
      noise: style.noise * 0.5,
    };
  }

  if (metric === "eeg") {
    return {
      amp: style.amp * 0.9,
      freq: style.freq * 1.25,
      noise: style.noise * 1.1,
    };
  }

  return style;
}

export function setWaveTargetsFromMechanics(waveTarget, mechanics) {
  waveTarget.heartRate = metricStyle("heartRate", mechanics.heart_rate);
  waveTarget.eeg = metricStyle("eeg", mechanics.eeg);
  waveTarget.gsr = metricStyle("gsr", mechanics.gsr);
}

export function updateWave(wave, waveTarget, dt) {
  const metrics = ["heartRate", "eeg", "gsr"];
  for (const metric of metrics) {
    const curr = wave[metric];
    const target = waveTarget[metric];
    const smooth = Math.min(1, dt * 4.5);
    curr.amp += (target.amp - curr.amp) * smooth;
    curr.freq += (target.freq - curr.freq) * smooth;
    curr.noise += (target.noise - curr.noise) * smooth;
  }
}
