---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

Wire the 92 formerly-dormant `embeddedDocs` entries (MathTS-native extensions: CAS/algebra, geometry, numeric, probability, signal, special) into the docs index — `help('polyFit')`, `help('gaussQuad')`, `help('besselJ0')`, etc. now work; previously these doc files existed but were invisible to `help()`. The one doc for a nonexistent function (`distribution`, a removed mathjs factory) was deleted rather than wired. A completeness test now pins that every documented function exists in the surface (docs never lie). Combined with the transform wiring, the expression package's dormant-file count drops 127 → ~4.
