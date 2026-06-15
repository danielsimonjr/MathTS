# @danielsimonjr/mathts-workerpool

Workerpool (mathts fork) for [MathTS](https://github.com/danielsimonjr/mathts).

MathTS's fork of [workerpool](https://github.com/josdejong/workerpool) — worker-pool management for offloading computations to Web Workers / worker threads. Underpins `@danielsimonjr/mathts-parallel`.

## Install

```sh
npm install @danielsimonjr/mathts-workerpool
```

## What it provides

- Pool of reusable workers with task queueing and load balancing.
- Per-task timeout with worker termination + replacement (used by the parallel matrix ops).
- Browser (Web Worker) and Node (worker_threads) support.

## License

MIT (c) Daniel Simon Jr.
