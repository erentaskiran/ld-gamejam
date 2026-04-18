# Timer Module

Source file: `js/timer.js`

## Responsibilities
- Provide delayed tasks, repeating tasks, and named cooldown mechanics.

## API Summary
- `after(ms, fn)`: Schedules a one-shot delayed task.
- `every(ms, fn)`: Schedules a repeating task and returns a cancel function.
- `cooldown(name, ms)`: Checks and sets named action cooldown.
- `updateTimers(dtMs)`: Advances the timer system.

## Notes
- Calling the cancel function returned by `every` deactivates that interval task.
