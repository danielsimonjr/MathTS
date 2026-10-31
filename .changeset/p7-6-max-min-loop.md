---
'@danielsimonjr/mathts-functions': patch
---

Performance: loop-based `max`/`min` on plain arrays (P7-6). Large arrays no longer overflow the stack on Node.
