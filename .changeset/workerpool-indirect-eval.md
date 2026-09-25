---
'@danielsimonjr/mathts-workerpool': patch
---

Shipped function sources are now compiled in the global scope through one helper, `compileFunctionSource`, instead of a direct `eval` inside each worker kernel. A direct `eval` let the shipped code read and reassign the kernel's own locals, made the engine de-optimise the kernel, and stopped esbuild from minifying it (8 `direct-eval` build warnings). A function source that depended on a kernel's locals was already a bug; any self-contained function behaves as before.
