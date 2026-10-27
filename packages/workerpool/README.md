# @danielsimonjr/mathts-workerpool

`MathWorkerPool` wrapper for MathTS parallel workloads.

## Relationship to the workerpool fork

Task queueing and worker threads come from the npm alias `workerpool` → `npm:@danielsimonjr/workerpool@10.2.2` (`@danielsimonjr/workerpool` on npm). This package adds `MathWorkerPool`, transfer helpers, capability detection, and the `./worker` entry (`dist/worker.js`).

`MathWorkerPool.exec` forwards to `pool.exec(...).timeout(ms)`, which rejects on timeout but does **not** terminate workers. Hung-worker termination and replacement live in `@danielsimonjr/mathts-parallel` (`WorkerPool.execute(data, transferables?, timeoutMs?)` — third positional argument, used by `parallel/src/ParallelMatrix.ts`).

## Install

```sh
npm install @danielsimonjr/mathts-workerpool
```

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

Subpath `@danielsimonjr/mathts-workerpool/worker` exposes the worker script bundle.

`@internal` exports (for `@danielsimonjr/mathts-parallel`, not part of the stable public API):
`chunkTyped`, `chunkPairTyped`, and `forEachMultiIndex` — slice-based typed-array chunking and
row-major multi-index iteration shared with `dist/worker.js`.

## License

MIT (c) Daniel Simon Jr.
