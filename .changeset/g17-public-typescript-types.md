---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-units': patch
---

Publish public call overloads generated from the live typed-function signatures (add, abs, sqrt, exp, log, trig, mean, variance, std, det, evaluate), keep them in sync with a failing check, fix `Unit` as a type via interface merge, and stop referencing `@webgpu/types` so consumers resolve WebGPU names from the TypeScript DOM lib.
