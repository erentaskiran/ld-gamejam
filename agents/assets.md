# Assets Module

Source file: `js/assets.js`

## Responsibilities
- Preload image and audio assets.
- Store loaded assets in memory maps.
- Report loading progress through a callback.

## API Summary
- `preloadAssets(config, onProgress)`: Loads all configured images/audio.
- `getImage(name)`: Returns a loaded image by name.
- `getAudio(name)`: Returns a loaded audio object by name.

## Notes
- `config.images` and `config.audio` should be `name -> path` maps.
- The preload promise rejects if any asset fails to load.
