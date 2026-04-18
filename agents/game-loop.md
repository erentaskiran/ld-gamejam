# Game Loop Module

Source file: `js/gameLoop.js`

## Responsibilities
- Provide a fixed-timestep update loop with render interpolation (`alpha`).
- Guard against large frame delta spikes.

## API Summary
- `createGameLoop({ update, render, fixedTimeStep, maxSubSteps })`
  - `start()`: Starts the loop.
  - `stop()`: Stops the loop.
  - `running`: Indicates whether the loop is active.

## Notes
- Large lag spikes are clamped to `0.25` seconds.
- `maxSubSteps` helps prevent spiral-of-death behavior.
