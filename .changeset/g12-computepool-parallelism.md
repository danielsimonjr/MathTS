---
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-workerpool': patch
---

ComputePool lazy-inits workers on parallel dispatch, throws after `terminate()`, validates `matmul` arity, and documents Vite worker URLs. Workerpool caps chunk count near `maxWorkers` for large arrays, resolves the worker script via `import.meta.resolve` in browsers, and auto-inits on `exec`.
