# Audio Module

Source files: `js/audio.js`, `js/interrogationAudio.js`, `js/interrogationSound.js`

## Responsibilities

- Generate lightweight synth SFX (`playTypewriterKey`, `playLightBuzz`) via Web Audio.
- Provide optional HTMLAudio playback helpers (`playSfx`, `playMusic`, `stopMusic`) through asset registry.
- Control interrogation ambient audio profiles/modulation across scenes.

## API Summary

- `js/audio.js`
  - `playTypewriterKey(volume)`: Procedural key click used during text reveal.
  - `playLightBuzz(durationMs, intensity)`: Procedural buzz accent.
  - `playSfx(name, volume)`, `playMusic(name, loop, volume)`, `stopMusic()`.
- `js/interrogationAudio.js`
  - `enterInterrogationAudio()`, `stopInterrogationAudio()`.
  - `applyAmbientProfile(profile)`: Scene-level audio mood presets (`title`, `menu`, `verdict`, `result-good`, `result-bad`).
  - `startBootAmbient()`: Starts title ambient as soon as boot completes (with browser autoplay-unlock fallback).
  - `applyNodeAtmosphere(node, nodeId)`: Adjust mood/tension from dialogue markers (`choice.type`, `mechanics`, end-node id).
  - `applyDialogueAudio(evidence, fearBar, maxFearBar)`: Dynamic modulation/triggers from structured evidence markers (no text parsing).

## Notes

- Ambient engine (`InterrogationSound`) is loaded globally and guarded; audio helpers fail safely if unavailable.
- Current gameplay primarily relies on procedural audio, not preloaded music tracks.
- Title/menu ambiance includes low-intensity musical layers (`piano`, `organ`, `cello`) in the interrogation sound engine.
- Dialogue-driven modulation now applies smoothing + trigger cooldowns to avoid abrupt audio jumps.
- Heartbeat/pulse layers are restricted to interrogation gameplay (`play`) and muted in title/menu/verdict/result profiles.
