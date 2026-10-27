---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Isolate compat `create(all, config)` from the process-wide functions config via a synchronous `runWithConfig` overlay and a config proxy on the activated factory graph. Fixes audit I-9 (#425).
