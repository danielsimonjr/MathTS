---
'@danielsimonjr/mathts-parallel': minor
---

`ComputePool.workerCount` is 0 after `terminate()`, in agreement with `stats().totalWorkers`, and returns the configured `maxWorkers` again after `initialize()` (Refs #1016). Before: it returned `maxWorkers` (2 or 12) after `terminate()` while `stats().totalWorkers` was 0. Before the first worker starts, `workerCount` stays the configured `maxWorkers`, because block and distribution fan-out size their chunks from it. No other `ComputePool` state survives `terminate()`: `isReady()` is false and compute methods throw. The new getter `ComputePool.liveWorkerCount` gives the number of workers that run now (`stats().totalWorkers`): 0 on a fresh pool, at least 1 after `initialize()`, and 0 after `terminate()`.
