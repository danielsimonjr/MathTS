---
'@danielsimonjr/mathts-workerpool': patch
---

Adopt `@danielsimonjr/workerpool@10.2.2`, which uses `parentPort` in a `node:worker_threads` worker under Bun. Remove the `bun-worker-bridge.ts` workaround; `worker.ts` now calls `worker(methods)` directly.
