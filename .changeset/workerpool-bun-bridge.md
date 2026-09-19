---
'@danielsimonjr/mathts-workerpool': patch
---

Worker threads now answer under Bun. Bun defines Web Worker globals inside a `node:worker_threads` worker, which sent workerpool down its browser path, where tasks never arrived. Under Node the bridge does nothing.
