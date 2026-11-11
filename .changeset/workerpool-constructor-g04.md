---
'@danielsimonjr/mathts-parallel': patch
---

Fix `WorkerPool` constructor to throw synchronously when `workerScript` is missing or empty, instead of an unhandled rejection during async worker startup.
