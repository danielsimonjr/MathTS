---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts opt-in `crossoverProbability` (default 0). At 0 the coin is not drawn and the seed-7 pin is unchanged. Above 0, a successful coin draws a second tournament parent and `crossoverSubtrees`; failure falls through to mutation. The inherited parameters stay the first parent's.
