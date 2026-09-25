---
'@danielsimonjr/mathts-matrix': patch
---

The WASM allocation pool now recycles released blocks, so WebAssembly linear memory stays bounded. Allocations were never recorded in the pool, so nothing was reused, and the AssemblyScript binary's `--runtime stub` never frees memory: 5,000 allocate/release cycles grew it from 256 KiB to 128 MiB. A recycled block has its header `byteLength` rewritten to the requested size (kernels read their length from it), and `allocateFloat64ArrayEmpty` / `allocateInt32ArrayEmpty` zero-fill a reused block, as documented.
