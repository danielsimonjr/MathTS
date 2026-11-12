---
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-workerpool': patch
---

ComputePool lazy-inits workers on parallel dispatch, throws after `terminate()` on every compute method, and rejects a swapped `matmul` call before stringifying buffers. Workerpool sizes large-array chunks from `maxWorkers` with a 65,536-element floor, resolves `new URL('./worker.js', import.meta.url)`, and rewrites Vite's prebundled `/.vite/deps/worker.js` to the package worker. An in-flight `initialize()` cannot leave workers running after `terminate()`.
