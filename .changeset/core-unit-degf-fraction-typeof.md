---
'@danielsimonjr/mathts-core': patch
---

Fix temperature-unit conversions and preserve degree-symbol notation in the merged `Unit`:

- `Unit.parse` normalizes `°C`→`degC`, `°F`→`degF`, `°`→`deg` before tokenizing (the mathjs parser rejects `°`), so the merged Unit accepts the same inputs the previous core Unit did.
- `new Fraction(fraction)` now clones its argument instead of falling through to `BigInt(fraction)`, which threw for non-integer values (e.g. `degF`'s `5/9` factor).
- `typeOf(value)` returns canonical `'Complex'`/`'Fraction'` for those types instead of `constructor.name` (which a bundler mangles to `_Complex`/`_Fraction`), fixing the Unit's value-type converter dispatch in the built bundle.

Net effect: `degF`/`°F` conversions (`32 °F → 0 degC`) now work.
