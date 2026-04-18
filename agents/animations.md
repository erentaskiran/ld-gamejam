# Animations Module

Source file: `js/animations.js`

## Responsibilities
- Build frame lists.
- Manage single animation state (`play/pause/stop/update`).
- Manage named animation sets (for example `idle/run`).

## API Summary
- `createSpriteSheet(frameWidth, frameHeight, frameCount, startX, startY)`: Creates a horizontal frame list.
- `createAnimation(config)`: Returns one animation controller object.
- `createAnimationSet(config)`: Manages multiple named animations together.

## Notes
- `fps` must be a positive number, otherwise an error is thrown.
- `createAnimationSet.play(name)` requires a valid animation name.
