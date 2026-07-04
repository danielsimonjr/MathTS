---
'@danielsimonjr/mathts-core': minor
---

Add `BigNumber.prototype.div` and `.times` — short-name aliases for `divide`/`multiply`, matching the Decimal.js / mathjs calling convention already followed by `Complex` and `Fraction` (`.div`/`.mul`/`.sub`). Both accept the same operand types as their long forms (BigNumber, number, string). Needed by the mathjs-derived `Unit` (which calls `.div`/`.times` on BigNumber unit values) as it merges into core, and useful for general Decimal.js API parity.
