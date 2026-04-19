# Assets Module

Source file: `js/assets.js`

## Responsibilities

- Preload image and audio assets asynchronously.
- Keep loaded assets in in-memory maps keyed by asset name.
- Expose image/audio lookup helpers for runtime modules.

## API Summary

- `preloadAssets(config, onProgress)`: Loads `config.images` and `config.audio` maps; optional progress callback receives `0..1`.
- `getImage(name)`: Returns a loaded image by name.
- `getAudio(name)`: Returns a loaded audio object by name.

## Notes

- `config.images` and `config.audio` should be `name -> path` maps.
- The preload promise rejects if any asset fails to load.
- Current `main.js` boot path preloads only image assets; audio is synthesized in runtime modules.
