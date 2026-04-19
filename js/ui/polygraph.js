import { drawRect, drawText } from '../draw.js';
import { clamp } from '../math.js';
import { COLORS, UI_FONT } from './theme.js';

const TRACE_STATE = {
  heart: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
  eeg: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
  gsr: { samples: null, width: 0, lastCursor: -1, bufferRef: null },
};


function drawLaneGrid(ctx, x, y, w, h) {
  drawRect(ctx, x, y, w, h, 'rgba(10, 6, 3, 0.55)');
  for (let gy = y + 4; gy < y + h; gy += 6) {
    drawRect(ctx, x, gy, w, 1, 'rgba(90, 60, 30, 0.08)');
  }
  for (let gx = x + 16; gx < x + w; gx += 16) {
    drawRect(ctx, gx, y, 1, h, 'rgba(90, 60, 30, 0.08)');
  }
}

function sampleFromRing(buffer, sampleRate, secondsAgo, sampleAt) {
  if (typeof sampleAt === 'function') {
    const offsetFloat = Math.max(0, secondsAgo * sampleRate);
    return sampleAt(offsetFloat);
  }
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const offset = Math.floor(secondsAgo * sampleRate);
  if (offset >= buffer.count) {
    const oldestIdx = (buffer.head - buffer.count + buffer.size * 4) % buffer.size;
    return buffer.data[oldestIdx];
  }
  const idx = (buffer.head - 1 - offset + buffer.size * 4) % buffer.size;
  return buffer.data[idx];
}

function sampleByOffset(buffer, offset) {
  if (!buffer || buffer.count <= 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(offset, buffer.count - 1));
  const idx = (buffer.head - 1 - clamped + buffer.size * 4) % buffer.size;
  return buffer.data[idx];
}

function resetTraceLane(lane, width, fill) {
  lane.samples = new Float32Array(width);
  lane.samples.fill(fill);
  lane.width = width;
  lane.lastCursor = -1;
}

function getLatestSample(buffer, sampleAt) {
  if (typeof sampleAt === 'function') {
    return sampleAt(0);
  }
  return sampleByOffset(buffer, 0);
}

function updateTraceLane(lane, buffer, width, sharedCursor, sampleAt) {
  if (!buffer || buffer.count <= 0 || width <= 2) {
    return;
  }

  const latest = getLatestSample(buffer, sampleAt);
  const resetNeeded = !lane.samples || lane.width !== width || lane.bufferRef !== buffer;
  if (resetNeeded) {
    resetTraceLane(lane, width, latest);
    lane.bufferRef = buffer;
  }

  if (lane.lastCursor === sharedCursor) {
    return;
  }

  if (lane.lastCursor < 0) {
    lane.samples[sharedCursor] = latest;
    lane.lastCursor = sharedCursor;
    return;
  }

  let steps = (sharedCursor - lane.lastCursor + width) % width;
  if (steps <= 0) {
    steps = 1;
  }

  for (let i = 1; i <= steps; i += 1) {
    const idx = (lane.lastCursor + i) % width;
    lane.samples[idx] = latest;
  }

  lane.lastCursor = sharedCursor;
}

function drawLaneWave(ctx, x, y, w, h, color, buffer, sampleRate, type, sampleAt, sharedCursor) {
  if (!buffer || buffer.count <= 1) {
    return;
  }

  const midY = y + h / 2;
  const gain = type === 'heart' ? h * 0.4 : type === 'eeg' ? h * 0.43 : h * 0.72;
  const lane = TRACE_STATE[type];
  updateTraceLane(lane, buffer, w, sharedCursor, sampleAt);
  if (!lane.samples) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let i = 0; i < w; i += 1) {
    const sample = lane.samples[i];
    const py = clamp(midY - sample * gain, y + 1, y + h - 1);
    if (i === 0) {
      ctx.moveTo(x + i, py);
    } else {
      ctx.lineTo(x + i, py);
    }
  }
  ctx.stroke();

  ctx.restore();
}

function readout(type, profile, biometricReadout) {
  if (biometricReadout) {
    if (type === 'heart') {
      return `${Math.round(biometricReadout.bpm)} BPM`;
    }
    if (type === 'eeg') {
      return `${biometricReadout.eegUv.toFixed(1)} uV`;
    }
    return `${biometricReadout.gsrUs.toFixed(1)} uS`;
  }

  if (type === 'heart') {
    return `${Math.round(40 + profile.freq * 22)} BPM`;
  }
  if (type === 'eeg') {
    return `${(0.05 + profile.amp * 0.35).toFixed(2)} mV`;
  }
  return `${Math.round(8 + profile.amp * 42)} uS`;
}

function drawLane(
  ctx,
  x,
  y,
  w,
  h,
  {
    label,
    color,
    profile,
    type,
    time,
    metric,
    flash = 0,
    buffer,
    sampleRate,
    biometricReadout,
    sampleAt,
    sharedCursor,
    drawSweep,
  }
) {
  const labelW = 40;
  const valueW = 96;

  const waveX = x + labelW;
  const waveW = w - labelW - valueW;

  drawLaneGrid(ctx, waveX, y + 2, waveW, h - 4);

  if (drawSweep) {
    const sweepX = waveX + sharedCursor;
    drawRect(ctx, sweepX - 8, y + 2, 8, h - 4, 'rgba(224, 72, 72, 0.10)');
    drawRect(ctx, sweepX - 2, y + 2, 2, h - 4, 'rgba(224, 72, 72, 0.18)');
  }

  drawLaneWave(
    ctx,
    waveX,
    y + 2,
    waveW,
    h - 4,
    color,
    buffer,
    sampleRate,
    type,
    sampleAt,
    sharedCursor
  );

  if (flash > 0.001) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.4, flash * 0.4);
    drawRect(ctx, waveX, y + 2, waveW, h - 4, color);
    ctx.restore();
  }

  drawText(ctx, label, x + 4, y + h / 2, {
    size: 12,
    color,
    font: UI_FONT,
    baseline: 'middle',
  });

  drawText(ctx, `${readout(type, profile, biometricReadout)} ${metric}`, x + w - 4, y + h / 2, {
    size: 11,
    color: COLORS.cream,
    align: 'right',
    font: UI_FONT,
    baseline: 'middle',
  });
}

export function drawPolygraph(ctx, x, y, w, h, data) {
  const {
    waves,
    time,
    metrics,
    fearBar,
    maxFearBar,
    fearFlash = 0,
    laneFlash = {},
    biometric,
  } = data;

  const bioBuffers = biometric?.buffers || {};
  const bioRate = biometric?.sampleRate || {};
  const bioReadout = biometric?.readout || null;
  const bioSampleAt = biometric?.sampleAt || null;

  drawRect(ctx, x, y, w, h, COLORS.panelSolid);
  drawRect(ctx, x, y, w, 1, COLORS.amber);

  const headerH = 16;

  drawText(ctx, 'POLYGRAPH SIGNALS', x + 6, y + headerH / 2 + 1, {
    size: 12,
    color: COLORS.amberBright,
    font: UI_FONT,
    baseline: 'middle',
  });

  const fearValText = `${Math.round(fearBar)}/${maxFearBar}`;
  const fearValX = x + w - 6;
  const fearValWidth = 36;
  const fearBarW = 56;
  const fearBarX = fearValX - fearValWidth - fearBarW;
  const fearLabelX = fearBarX - 4;
  const fearMidY = y + headerH / 2 + 1;

  drawText(ctx, 'FEAR', fearLabelX, fearMidY, {
    size: 12,
    color: COLORS.cream,
    align: 'right',
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, fearBarX, y + headerH / 2 - 3, fearBarW, 6, COLORS.fearTrack);
  const ratio = clamp(fearBar / maxFearBar, 0, 1);
  drawRect(ctx, fearBarX, y + headerH / 2 - 3, fearBarW * ratio, 6, COLORS.fear);
  if (fearFlash > 0.001) {
    drawRect(
      ctx,
      fearBarX,
      y + headerH / 2 - 3,
      fearBarW,
      6,
      `rgba(255, 220, 150, ${Math.min(0.75, fearFlash * 0.75)})`
    );
  }

  drawText(ctx, fearValText, fearValX, fearMidY, {
    size: 12,
    color: COLORS.cream,
    align: 'right',
    font: UI_FONT,
    baseline: 'middle',
  });

  drawRect(ctx, x, y + headerH, w, 1, COLORS.amberDim);

  const lanesY = y + headerH + 2;
  const lanesH = h - headerH - 4;
  const laneH = Math.floor(lanesH / 3);
  const labelW = 40;
  const valueW = 96;
  const waveW = w - labelW - valueW;
  const sharedCursor = Math.floor((time * 28) % Math.max(1, waveW));

  drawLane(ctx, x, lanesY, w, laneH, {
    label: 'PULSE',
    color: COLORS.pulse,
    profile: waves.heartRate,
    type: 'heart',
    time,
    metric: metrics.heartRate,
    flash: laneFlash.heartRate || 0,
    buffer: bioBuffers.heartRate,
    sampleRate: bioRate.heartRate || 250,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('heartRate', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
  });

  drawLane(ctx, x, lanesY + laneH, w, laneH, {
    label: 'EEG',
    color: COLORS.eeg,
    profile: waves.eeg,
    type: 'eeg',
    time,
    metric: metrics.eeg,
    flash: laneFlash.eeg || 0,
    buffer: bioBuffers.eeg,
    sampleRate: bioRate.eeg || 256,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('eeg', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
  });

  drawLane(ctx, x, lanesY + laneH * 2, w, laneH, {
    label: 'GSR',
    color: COLORS.gsr,
    profile: waves.gsr,
    type: 'gsr',
    time,
    metric: metrics.gsr,
    flash: laneFlash.gsr || 0,
    buffer: bioBuffers.gsr,
    sampleRate: bioRate.gsr || 64,
    biometricReadout: bioReadout,
    sampleAt: bioSampleAt ? (offsetFloat) => bioSampleAt('gsr', offsetFloat) : null,
    sharedCursor,
    drawSweep: true,
  });
}
