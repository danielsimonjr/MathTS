---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

A failed WASM load no longer disables WASM for the rest of the process. Both loaders cached the in-flight load promise and never cleared it, so one bad path or transient fetch error made every later `load()` return the same rejection. It is now cleared however the load settles, and a failed load also drops the compiled module: a binary that compiled but failed to instantiate used to stay cached, so every later `load()` instantiated it again instead of reading the binary it was given.
