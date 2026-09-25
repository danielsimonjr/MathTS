---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

A failed WASM load no longer disables WASM for the rest of the process. Both loaders cached the in-flight load promise and never cleared it, so one bad path or transient fetch error made every later `load()` return the same rejection. It is now cleared however the load settles.
