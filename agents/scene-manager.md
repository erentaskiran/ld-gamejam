# Scene Manager Module

Source file: `js/sceneManager.js`

## Responsibilities

- Register scenes and route update/render to the active scene.
- Handle fade-out/fade-in transitions when switching scenes.
- Track pending scene/context during transition.

## API Summary

- `registerScene(name, scene)`: Registers a scene.
- `setScene(name, context)`: Immediate first scene enter; later calls trigger fade-out swap.
- `updateScene(dt, context)`: Calls update on the active scene.
- `renderScene(context)`: Calls render on the active scene.
- `getCurrentSceneName()`: Returns the active scene name.
- `getTransitionAlpha()`: Returns current fade alpha (`0..1`) for overlay rendering.
- `isTransitioning()`: Whether transition phase is active.

## Notes

- `setScene` throws if scene name is unknown.
- `currentScene.exit()` receives pending context before swap; `nextScene.enter()` receives the same context.
