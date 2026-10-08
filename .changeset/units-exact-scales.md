---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-units': minor
---

Unit values are now exact, and the built-in units live in one table.

**Corrected values** (SI value of 1 unit; old → new):

- `torr`: 133.322 → 133.32236842105263 Pa (101325/760 Pa exactly)
- `mmHg`, `mmhg`: 133.322 → 133.322387415 Pa (conventional mmHg, NIST SP 811). `torr` and `mmHg` are now distinct.
- `psi`: 6894.75729276459 → 6894.757293168362 Pa (lbf/in²)
- `hp`: 745.6998715386 → 745.6998715822702 W (550 ft·lbf/s)
- `kip`, `kips`: 4448.2216 → 4448.2216152605 N (1000 lbf)
- `parsec`, `pc`, `parsecs`: 30856775814913700 → 30856775814913670 m (648000/π au, IAU 2015 B2)
- `rd`: 5.02921 → 5.0292 m (16.5 ft, the same as `rod`)
- `sqrd`: 25.29295 → 25.29285264 m² ((16.5 ft)²)
- `sqch`: 404.6873 → 404.68564224 m² ((66 ft)²)
- `acre`, `acres`: 4046.86 → 4046.8564224 m² (43 560 ft²)
- `pica`, `picas`: 0.004233333333333333 → 0.004233333333333334 m (1/6 in, now rounded once)
- the flat registry (`ALL_UNITS` / `DERIVED_UNITS`): `torr` 133.322368421 → 133.32236842105263 Pa and `psi` 6894.757293168361 → 6894.757293168362 Pa.

**One table, exact scales.** `UNIT_ROWS` (`core/src/types/unit/unit-table.ts`) states every built-in unit's scale as an exact expression (`psi: 'lbf/inch^2'`, `hp: '550*foot*lbf'`, `torr: 'standard_atmosphere/760'`, `parsec: '648000*astronomical_unit/pi'`) over named defining values (`NAMED_SCALES`), and `UNIT_ROW_ALIASES` lists the other spellings. The `Unit` class builds `UNITS` from it, and `ALL_UNITS` / `DERIVED_UNITS` read their multipliers from it, so the two can no longer disagree. Each value is the exact scale rounded once (`exactScaleToNumber`, π carried to 120 digits).

**Conversions round once.** A number-valued `Unit` with built-in units converts through the exact product of its unit and prefix scales: `1 g/cm^3` is 1000 kg/m³ (was 999.9999999999999), `72 mN/m` is 0.072 N/m (was 0.07200000000000001), and `1 m` in `ft` is 3.2808398950131235 (the correctly rounded 1/0.3048; was 3.280839895013123, one ulp low). Expect last-digit changes like this wherever the old float route rounded twice. A typed reading is taken as the decimal it prints as; a normalized value is taken at its exact binary value. Offset conversions are exact too: `212 degF` is 100 degC, `32 degF` is 273.15 K, and a number value now stays a number (it came back as a `Fraction` before, because `degF`'s scale was stored as `Fraction(5, 9)`). Fraction values convert exactly and BigNumber values at their precision. Units made with `createUnit`, VAR, and non-integer powers keep the float route.

**New.** `cal` / `calorie` / `calories`: the thermochemical calorie, 4.184 J (so `kcal` is 4184 J); it was in `ALL_UNITS` but not in `Unit`. `Unit.exactScale(text)` and `unit.exactScale()` return a unit's exact SI scale (`{ num, den, pi }`, bigints and a power of π) or null. Exported from core and units: `UNIT_ROWS`, `UNIT_ROW_ALIASES`, `NAMED_SCALES`, `getUnitRow`, `unitRowExactScale`, `unitRowValue`, `namedExactScale`, `readUnitScale`, and the exact-scale functions (`exactScaleToNumber`, `exactScaleOf`, `binaryExactScale`, `decimalExactScale`, `ratioExactScale`, `multiplyExactScales`, `divideExactScales`, `powerExactScale`, `addExactScales`, `exactScalesEqual`, `formatExactScale`, `readScaleExpression`, `UNIT_EXACT_SCALE`, `PI_EXACT_SCALE`) with the `ExactScale`, `UnitRow`, `UnitBaseKey`, `UnitPrefixSetKey` and `UnitPrefix` types.

**Prefixes and offsets in the table.** `UNIT_PREFIX_SETS` states every prefix set as `radix^power`, generated from one SI list (quecto to quetta) and one IEC list. `Unit.PREFIXES` is built from it (same keys, prefixes and values as before). `getUnitPrefix(unit, prefix)` says whether a built-in unit takes a prefix, `unitPrefixExactScale` gives the prefix's exact factor, and `unitRowExactOffset` gives an affine unit's exact offset in its own degrees (`degF`: 459.67). `SI_PREFIXES` is now read from the same set, so it gains `R`, `Q`, `r` and `q` (1e27, 1e30, 1e-27, 1e-30), which the hand-written list was missing.

Conventions kept and now labelled in the table: `teaspoon`/`tablespoon` are the metric 5 mL / 15 mL, `drop` is 0.05 mL, `stick` is 0.115 kg, `month` is 1/12 Julian year, `BTU` is the International Table BTU, and `bit` (`b`) is its own BIT dimension (storage), not ln 2 nat.

This changes numeric results, so it is a minor bump on these 0.x packages.
