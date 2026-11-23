---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

Compute signed Hermite overflows from a phase bound when possible. Above degree 10,000,000, an input whose sign cannot be certified raises promptly. Certified overflows are still supported up to the existing degree limits.
