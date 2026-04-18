# Pool Module

Source file: `js/pool.js`

## Responsibilities
- Provide a simple object pool for reusing instances.

## API Summary
- `createPool(createFn, resetFn)`
  - `acquire()`: Gets an item from pool or creates a new one.
  - `release(item)`: Resets item and returns it to pool.
  - `size()`: Returns number of currently free items.

## Notes
- Useful for high-frequency temporary objects to reduce GC pressure.
