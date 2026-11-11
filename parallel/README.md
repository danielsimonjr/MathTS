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

## License

MIT (c) Daniel Simon Jr.
