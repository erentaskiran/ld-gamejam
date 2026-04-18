# Scene Manager Module

Source file: `js/sceneManager.js`

## Responsibilities
- Register scenes, switch scenes, and route update/render calls to the active scene.

## API Summary
- `registerScene(name, scene)`: Registers a scene.
- `setScene(name, context)`: Switches scene and runs `exit/enter` hooks.
- `updateScene(dt, context)`: Calls update on the active scene.
- `renderScene(context)`: Calls render on the active scene.
- `getCurrentSceneName()`: Returns the active scene name.

## Notes
- `setScene` throws if the scene name is not registered.
