---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` honors `grammar.admit` on seeds and mutation offspring. A rejected seed is skipped; a rejected child is a failed mutation attempt. `admit` must be a pure function of the node. When `admit` is omitted the seed-7 pin is unchanged.
