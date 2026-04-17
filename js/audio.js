import { getAudio } from "./assets.js";

let currentMusic = null;

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
