import { getAudio } from './assets.js';

let currentMusic = null;
let audioCtx = null;

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window['webkitAudioContext'];
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

let distortionCurve = null;
function makeDistortionCurve(amount = 60) {
  const n = 1024;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function makeNoiseBuffer(ctx, durationSec) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playLightBuzz(durationMs = 80, intensity = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const dur = Math.max(0.03, durationMs / 1000);

  const gain = ctx.createGain();
  const peak = 0.05 + intensity * 0.07;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110 + Math.random() * 10, now);
  osc.frequency.linearRampToValueAtTime(92 + Math.random() * 8, now + dur);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(220 + Math.random() * 20, now);
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.35;

  const preGain = ctx.createGain();
  preGain.gain.value = 3 + intensity * 4;

  if (!distortionCurve) distortionCurve = makeDistortionCurve(80);
  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve;
  shaper.oversample = '4x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 480;
  filter.Q.value = 5;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur + 0.05);
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.12 * intensity;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 900;

  osc.connect(preGain);
  osc2.connect(gain2).connect(preGain);
  preGain.connect(shaper).connect(filter).connect(gain);
  noise.connect(noiseFilter).connect(noiseGain).connect(gain);
  gain.connect(ctx.destination);

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.14 + Math.random() * 0.04;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.55;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 1800;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;

  gain.connect(delay);
  delay.connect(damp).connect(feedback).connect(delay);
  delay.connect(wet).connect(ctx.destination);

  const tail = 1.6;
  wet.gain.setValueAtTime(0.45, now + dur);
  wet.gain.exponentialRampToValueAtTime(0.0001, now + dur + tail);

  osc.start(now);
  osc2.start(now);
  noise.start(now);
  osc.stop(now + dur + 0.02);
  osc2.stop(now + dur + 0.02);
  noise.stop(now + dur + 0.05);
}

export function playSfx(name, volume = 1) {
  const source = getAudio(name);
  if (!source) {
    return;
  }

  const sound = source.cloneNode();
  sound.volume = Math.max(0, Math.min(1, volume));
  sound.play().catch(() => {});
}

export function playMusic(name, loop = true, volume = 0.6) {
  const music = getAudio(name);
  if (!music) {
    return;
  }

  if (currentMusic && currentMusic !== music) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
  }

  currentMusic = music;
  currentMusic.loop = loop;
  currentMusic.volume = Math.max(0, Math.min(1, volume));
  currentMusic.play().catch(() => {});
}

export function stopMusic() {
  if (!currentMusic) {
    return;
  }

  currentMusic.pause();
  currentMusic.currentTime = 0;
  currentMusic = null;
}
