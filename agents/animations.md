# Animations Module

Source file: `js/animations.js`

## Responsibilities

- Build sprite frame lists for horizontal sheets.
- Manage single animation playback state (`play/pause/stop/update`).
- Manage named animation groups and switch active animation safely.

## API Summary

- `createSpriteSheet(frameWidth, frameHeight, frameCount, startX, startY)`: Creates a horizontal frame list.
- `createAnimation(config)`: Returns one animation controller object.
- `createAnimationSet(config)`: Manages multiple named animations together.

## Notes

- `createAnimation` also supports `setFrames`, `setImage`, `setFPS`, and `getFrame`.
- Invalid frame arrays and invalid FPS values throw explicit errors.
- `createAnimationSet` resolves images from either direct `image` or `imageName` via assets registry.
