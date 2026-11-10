---
'@danielsimonjr/mathts-core': patch
---

`Unit.readings` is about 12 times faster. The unit lookup scanned every name in `Unit.UNITS` on each miss. It now scans only the names that end in the last character of the spelling. The result is the same unit and prefix as the old scan, in the same insertion order. The old result memo is replaced by a memo of hits only. Each hit is checked against `Unit.UNITS` before it is used, so a name written directly to `Unit.UNITS` after a miss is found.

The lookup tracks a direct write to `Unit.UNITS` only for a new name. It does not track a direct delete and re-add of a name (the old memo did not track it either), and it never finds an empty-string name written directly. `Unit.createUnitSingle` and `Unit.deleteUnit` are tracked.

Measured on one machine in one session (median of 9 runs, 28,041 glued tokens, `tools/benchmark/unit-readings/bench.mjs`):

- `Unit.readings`: 1,072 to 1,459 us per token before, 82 to 120 us per token after (13.1x and 12.2x).
- `Unit.parse`, 10,000 distinct expressions: 1.0x to 1.07x.
- `Unit.parse`, the same 1,000 expressions 10 times: the same as before with the hit memo (0.87x without it).
