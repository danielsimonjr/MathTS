# @danielsimonjr/mathts-parallel

Parallel compute for [MathTS](https://github.com/danielsimonjr/mathts).

WebWorker / worker-thread parallelization for MathTS, built on `@danielsimonjr/mathts-workerpool`.

## Install

```sh
npm install @danielsimonjr/mathts-parallel
```

## What it provides

- `ComputePool` for chunked, parallel elementwise and matrix operations over `Float64Array` data.
- Threshold strategies that fall back to sequential execution for small inputs.
- Opt-in per-task timeouts with hung-worker replacement.

## License

MIT (c) Daniel Simon Jr.
