---
'@danielsimonjr/mathts-matrix': patch
---

Fix the `sumReduce` WGSL kernel, which never compiled. It named its workgroup
array `shared` — a **reserved keyword in WGSL** — so the shader failed to parse
(`error: 'shared' is a reserved keyword`) and the reduction was permanently
unusable on the GPU. The failure was silent: the compile error surfaced only as an
uncaptured `GPUValidationError`, and nothing asserted on shader compilation. Renamed
to `sdata`, and added a browser regression guard that compiles every builtin WGSL
kernel and fails on any error-severity diagnostic.
