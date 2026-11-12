# @danielsimonjr/mathts-workerpool

`MathWorkerPool` wrapper for MathTS parallel workloads.

## Relationship to the workerpool fork

Task queueing and worker threads come from the npm alias `workerpool` → `npm:@danielsimonjr/workerpool@10.2.2` (`@danielsimonjr/workerpool` on npm). This package adds `MathWorkerPool`, transfer helpers, capability detection, and the `./worker` entry (`dist/worker.js`).

`MathWorkerPool.exec` forwards to `pool.exec(...).timeout(ms)`, which rejects on timeout but does **not** terminate workers. Hung-worker termination and replacement live in `@danielsimonjr/mathts-parallel` (`WorkerPool.execute(data, transferables?, timeoutMs?)` — third positional argument, used by `parallel/src/ParallelMatrix.ts`).

## Install

```sh
npm install @danielsimonjr/mathts-workerpool
```

## Example

```ts
import {
  MathWorkerPool,
  initializePool,
  terminatePool,
  getPoolStats,
} from '@danielsimonjr/mathts-workerpool';

const pool = await initializePool({ maxWorkers: 2 });
const stats = getPoolStats();
console.log(pool instanceof MathWorkerPool, stats.totalWorkers >= 0);
await terminatePool();
```

For application parallel math, prefer `@danielsimonjr/mathts-parallel` (`ComputePool` wires the
worker script for you).

## Main exports (`.`)

| Name                                                                                       | Role                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `MathWorkerPool`                                                                           | Pool class                                                              |
| `mathWorkerPool`                                                                           | Default singleton                                                       |
| `initializePool` / `terminatePool`                                                         | Lifecycle                                                               |
| `DEFAULT_WORKER_CONFIG`                                                                    | `{ parallelThreshold: 10000, chunkSize: 5000, taskTimeout: 300000, … }` |
| `getCapabilities`, `canUseWasm`, `canUseSharedMemory`                                      | Environment probes                                                      |
| `transferFloat64`, `transferTypedArray`, `transferArrayBuffer`, `createSharedFloat64Array` | Zero-copy transfers                                                     |
| `getPoolStats`                                                                             | Pool statistics                                                         |
| `chunkTyped`, `chunkPairTyped`, `forEachMultiIndex`                                        | Typed-array chunking helpers (also used by `mathts-parallel`)           |
| `tensordotRange`, `matmulSequential`                                                       | Worker-side numeric kernels                                             |

Subpath `@danielsimonjr/mathts-workerpool/worker` exposes the worker script bundle.

These low-level helpers are on the root export surface for integrators (`parallel` imports them).
Treat them as stable public API; semver applies.

## License

MIT (c) Daniel Simon Jr.
