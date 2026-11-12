# @danielsimonjr/mathts-parallel

Parallel compute for [MathTS](https://github.com/danielsimonjr/mathts).

WebWorker / worker-thread parallelization for MathTS, built on `@danielsimonjr/mathts-workerpool`.

## Install

```sh
npm install @danielsimonjr/mathts-parallel
```

## What it provides

- `ComputePool` for chunked work over `Float64Array` data (parallel only when an op's
  threshold is met — most element-wise defaults are `'never'` / sequential).
- Workers start on the first parallel dispatch (including `{ forceParallel: true }`);
  `await pool.initialize()` is optional but still supported.
- After `await pool.terminate()`, further pool calls throw `ComputePool has been terminated`.
- `DEFAULT_THRESHOLD_BY_OP`, `resolveOpThreshold`, standalone `parallel*` helpers, and
  bitwise ops.
- `WorkerPool`, the low-level pool that `execute(data, transferables?, timeoutMs?)` runs on:
  opt-in per-task timeouts with hung-worker replacement. A call that waits in the queue is
  covered by its timeout too, and `terminate()` cancels the timers and stops a worker that
  was still starting. `@danielsimonjr/mathts-functions` uses it for `searchScalars`
  (`parallel` option). Construction requires a non-empty `workerScript` (worker entry path
  or `file://` URL string, not a `URL` object). Omit it and construction throws
  `TypeError` before any worker starts. For chunked numeric work prefer `ComputePool`,
  which wires the worker script for you.

## Vite / browser workers

Vite must not resolve the worker through a prebundled `import.meta.url` on the package
entry (that 404s as `/node_modules/.vite/deps/worker.js`). Pass an explicit worker URL:

```ts
import { ComputePool } from '@danielsimonjr/mathts-parallel';
import workerUrl from '@danielsimonjr/mathts-workerpool/worker?url';

const pool = new ComputePool({ workerScript: workerUrl, maxWorkers: 4 });
await pool.sin(large, { forceParallel: true });
```

`resolveDefaultWorkerScript()` (re-exported from this package) uses
`import.meta.resolve('@danielsimonjr/mathts-workerpool/worker')` in modern browsers when
no `workerScript` is set.

## License

MIT (c) Daniel Simon Jr.
