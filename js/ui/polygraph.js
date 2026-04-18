import { drawRect, drawText } from "../draw.js";
import { clamp } from "../math.js";
import { COLORS, UI_FONT } from "./theme.js";

function signalNoise(x, t) {
  return (
    Math.sin(x * 0.17 + t * 1.41) * 0.5 +
    Math.sin(x * 0.048 - t * 2.1) * 0.3 +
    Math.sin(x * 0.29 + t * 0.5) * 0.2
  );
}

function ekgPulse(phase) {
  if (phase < 0.02) return phase * 12;
  if (phase < 0.06) return 0.22 - (phase - 0.02) * 9;
  if (phase < 0.09) return -0.18 + (phase - 0.06) * 4;
  if (phase < 0.11) return 1.35 - (phase - 0.09) * 52;
  if (phase < 0.145) return -0.42 + (phase - 0.11) * 10;
  return Math.sin((phase - 0.145) * 8) * 0.06;
}

function sampleWave(nx, time, profile, type) {
  const noise = signalNoise(nx * 600, time) * profile.noise;
  if (type === "heart") {
    const cycle = (time * profile.freq + nx * 4.8) % 1;
    return ekgPulse(cycle) * profile.amp + noise;
  }
  if (type === "eeg") {
    return (
      (Math.sin(time * profile.freq * 6 + nx * 30) * 0.45 +
        Math.sin(time * profile.freq * 8 - nx * 18) * 0.35 +
        Math.sin(time * profile.freq * 2 + nx * 10) * 0.25) *
        profile.amp +
      noise
    );
  }
  return (
    (Math.sin(time * profile.freq * 2 + nx * 6) * 0.34 +
      Math.sin(time * profile.freq * 0.8 - nx * 4) * 0.18 +
      (nx - 0.5) * 0.08) *
      profile.amp +
    noise
  );
}

function drawLaneGrid(ctx, x, y, w, h) {
  drawRect(ctx, x, y, w, h, "rgba(10, 6, 3, 0.55)");
  for (let gy = y + 4; gy < y + h; gy += 6) {
    drawRect(ctx, x, gy, w, 1, "rgba(90, 60, 30, 0.08)");
  }
  for (let gx = x + 16; gx < x + w; gx += 16) {
    drawRect(ctx, gx, y, 1, h, "rgba(90, 60, 30, 0.08)");
  }
}

function drawLaneWave(ctx, x, y, w, h, color, profile, type, time) {
  const midY = y + h / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const step = 2;
  for (let i = 0; i <= w; i += step) {
    const nx = i / w;
    const sample = sampleWave(nx, time, profile, type);
    const py = midY - sample * (h * 0.42);
    if (i === 0) {
      ctx.moveTo(x + i, py);
    } else {
      ctx.lineTo(x + i, py);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function readout(type, profile) {
  if (type === "heart") {
    return `${Math.round(40 + profile.freq * 22)} BPM`;
  }
  if (type === "eeg") {
    return `${(0.05 + profile.amp * 0.35).toFixed(2)} mV`;
  }
  return `${Math.round(8 + profile.amp * 42)} uS`;
}

function drawLane(ctx, x, y, w, h, { label, color, profile, type, time, metric }) {
  const labelW = 48;
  const valueW = 130;
  const waveX = x + labelW;
  const waveW = w - labelW - valueW;

  drawLaneGrid(ctx, waveX, y + 2, waveW, h - 4);
  drawLaneWave(ctx, waveX, y + 2, waveW, h - 4, color, profile, type, time);

  drawText(ctx, label, x + 4, y + h / 2, {
    size: 16,
    color,
    font: UI_FONT,
    baseline: "middle",
  });

  drawText(ctx, `${readout(type, profile)} ${metric}`, x + w - 4, y + h / 2, {
    size: 16,
    color: COLORS.cream,
    align: "right",
    font: UI_FONT,
    baseline: "middle",
  });
}

export function drawPolygraph(ctx, x, y, w, h, data) {
  const { waves, time, metrics, fearBar, maxFearBar } = data;

  drawRect(ctx, x, y, w, h, COLORS.panelSolid);
  drawRect(ctx, x, y, w, 1, COLORS.amber);

  const headerH = 22;
  drawText(ctx, "POLYGRAPH ANALYSIS", x + 8, y + headerH / 2 + 1, {
    size: 16,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: "middle",
  });

  const fearValText = `${Math.round(fearBar)}/${maxFearBar}`;
  const fearValX = x + w - 8;
  const fearValWidth = 44;
  const fearBarW = 72;
  const fearBarX = fearValX - fearValWidth - fearBarW;
  const fearLabelX = fearBarX - 4;
  const fearMidY = y + headerH / 2 + 1;

  drawText(ctx, "FEAR", fearLabelX, fearMidY, {
    size: 16,
    color: COLORS.cream,
    align: "right",
    font: UI_FONT,
    baseline: "middle",
  });

  drawRect(ctx, fearBarX, y + headerH / 2 - 4, fearBarW, 8, COLORS.fearTrack);
  const ratio = clamp(fearBar / maxFearBar, 0, 1);
  drawRect(ctx, fearBarX, y + headerH / 2 - 4, fearBarW * ratio, 8, COLORS.fear);

  drawText(ctx, fearValText, fearValX, fearMidY, {
    size: 16,
    color: COLORS.cream,
    align: "right",
    font: UI_FONT,
    baseline: "middle",
  });

  drawRect(ctx, x, y + headerH, w, 1, COLORS.amberDim);

  const lanesY = y + headerH + 2;
  const lanesH = h - headerH - 4;
  const laneH = Math.floor(lanesH / 3);

  drawLane(ctx, x, lanesY, w, laneH, {
    label: "PULSE",
    color: COLORS.pulse,
    profile: waves.heartRate,
    type: "heart",
    time,
    metric: metrics.heartRate,
  });

  drawLane(ctx, x, lanesY + laneH, w, laneH, {
    label: "EEG",
    color: COLORS.eeg,
    profile: waves.eeg,
    type: "eeg",
    time,
    metric: metrics.eeg,
  });

  drawLane(ctx, x, lanesY + laneH * 2, w, laneH, {
    label: "GSR",
    color: COLORS.gsr,
    profile: waves.gsr,
    type: "gsr",
    time,
    metric: metrics.gsr,
  });
}
