# Audio Module

Source file: `js/audio.js`

## Responsibilities
- Play sound effects (SFX).
- Start/stop background music and keep a single active music stream.

## API Summary
- `playSfx(name, volume)`: Plays a short sound effect (cloned from source).
- `playMusic(name, loop, volume)`: Plays music, stopping previous different music first.
- `stopMusic()`: Stops and resets currently playing music.

## Notes
- Functions return safely if the requested audio is missing.
- Volume is clamped to the `0-1` range.
