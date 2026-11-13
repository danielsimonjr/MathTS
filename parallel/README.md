# @danielsimonjr/mathts-parallel

Parallel compute for [MathTS](https://github.com/danielsimonjr/mathts).

WebWorker / worker-thread parallelization for MathTS, built on `@danielsimonjr/mathts-workerpool`.

## Install

```sh
npm install @danielsimonjr/mathts-parallel
```

## Example

```ts node
import { computePool } from '@danielsimonjr/mathts-parallel';

await computePool.initialize();
const data = new Float64Array([1, 2, 3, 4, 5]);
const { result: total } = await computePool.sum(data);
console.log(total);
await computePool.terminate();
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

The default worker URL is `new URL('./worker.js', import.meta.url)` (in the browser build of
the package, `worker.browser.js`). Vite's production build rewrites that into an emitted worker
asset. In dev, the optimizer prebundles the package and that relative URL 404s as
`/node_modules/.vite/deps/worker.js`; the resolver then loads
`/node_modules/@danielsimonjr/mathts-workerpool/dist/worker.browser.js`, which the dev server
already serves. A bundler that targets the browser picks the `browser` export condition of
`@danielsimonjr/mathts-workerpool` and `@danielsimonjr/mathts-parallel`; those entries import no
Node builtin. A bundler build that targets browsers older than ES2022 needs
`build.target: 'es2022'` (or newer) for the top-level `await` of the page code itself.

On Node, let the package find its worker script:

```ts node
import { ComputePool, resolveDefaultWorkerScript } from '@danielsimonjr/mathts-parallel';

const large = new Float64Array(65_536).fill(0.5);
const pool = new ComputePool({ workerScript: await resolveDefaultWorkerScript(), maxWorkers: 2 });
const { result, parallelized } = await pool.sin(large, { forceParallel: true });
console.log(result.length, parallelized); // 65536 true
await pool.terminate();
```

In a Vite project you can pass an explicit URL. Vite resolves the `?url` suffix; add
`"types": ["vite/client"]` to `tsconfig.json` so that TypeScript accepts the import.

```ts browser
import { ComputePool } from '@danielsimonjr/mathts-parallel';
import workerUrl from '@danielsimonjr/mathts-workerpool/worker?url';

const large = new Float64Array(65_536);
const pool = new ComputePool({ workerScript: workerUrl, maxWorkers: 4 });
await pool.sin(large, { forceParallel: true });
```

`resolveDefaultWorkerScript()` (re-exported from this package) applies that fallback when
no `workerScript` is set. After `terminate()`, call `initialize()` to spawn workers again.

## License

MIT (c) Daniel Simon Jr.
