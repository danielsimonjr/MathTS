# @danielsimonjr/mathts-units

## 0.5.0

### Minor Changes

- 61426de: Add the units UPT was keeping locally, read a single solidus the ISO 80000 way, accept µ μ Ω ℃ and Å, convert cycle rates such as Hz to rad/s, and let createUnit register an exact scale.

### Patch Changes

- Updated dependencies [61426de]
  - @danielsimonjr/mathts-core@0.19.0

## 0.4.0

### Minor Changes

- 15adc89: Exact-scale follow-ups after #346:
  
  - **Breaking (0.x minor): `ExactScale` holds irrational powers in one map.** `{ num, den, pi, ln2 }` is now `{ num, den, irrationals }`, where `irrationals` maps a name from the new `NAMED_IRRATIONALS` registry (`pi`, `ln2`) to its nonzero integer power (`{}` for a rational scale, `{ pi: 1 }` for `deg`'s π). Parsing, arithmetic, rounding and formatting all read the registry, so a new constant is one entry there. New helpers: `namedIrrationalScale(name)`, `irrationalPower(scale, name)`, `isRationalScale(scale)`; new types `IrrationalName`, `IrrationalPowers`. `PI_EXACT_SCALE` and `LN2_EXACT_SCALE` remain.
  - **Behavior change from #346 (0.17.0), now documented: `UNITS.degF.value` and `UNITS.degR.value` are numbers.** They were `Fraction(5, 9)` before 0.17.0 and are now the double nearest 5/9, like every other unit value. The exact 5/9 is on the definition's exact scale; conversions of Fraction values stay exact through it.
  - **Scale expressions accept parentheses and whitespace.** `a/(b*c)` reads as a/(b·c) (the same as the single-solidus `a/b*c`), groups nest and take powers (`(1/2)^-1`), and spaces around tokens are ignored (`lbf / inch ^ 2`). Juxtaposition (`2 3`) and unbalanced groups throw.
  - **`exactScaleToNumber` rounds correctly at any magnitude.** Rounding is integer base-2 (53-bit significand, ties to even); the normalization shift comes from the operands' bit lengths, not a bit-by-bit loop. Values below the smallest normal double round on the fixed 2^-1074 grid, and values past the largest finite double overflow to Infinity at the tie. Both operands within 2^53 take one IEEE division, which rounds the same way.
  - **Conversions that still hold their exact SI reading round the AB ratio once.** A number-valued `Unit` built from a built-in exact unit keeps `_exactSI`; `to()` and `toNumeric(other)` use `reading x fromScale / toScale` rounded once. They use the stored quantity only while `value` is still the double it rounds to, so a unit changed by `abs()`, arithmetic, `splitUnit` or an assignment to `value` converts from its current SI double. `createUnit` / non-exact units stay on the float route.
  - **ln 2 is a registered irrational.** Scale expressions accept `ln2`; its constant holds 120 correct decimal places. The Fraction and BigNumber routes give no exact value for a scale with an ln 2 factor, so those callers use the float route. This lets units such as `nat` and `bit` carry ln 2 without embedding it as a float (see #347).
  - **Speed.** `Unit.prototype.exactScale` is memoized per unit list (definition, prefix and power of each component; at most 1024 lists). The constructor builds a number reading's exact SI quantity once and rounds it once; each exact scale object remembers its rounded double. `exactScaleToNumber` keeps its string-keyed memo, bounded at 4096 results, least recently used first. `bun tools/benchmarks/unit-conversions.ts [core/src]` measures the hot conversion paths.

### Patch Changes

- Updated dependencies [15adc89]
  - @danielsimonjr/mathts-core@0.18.0

## 0.3.0

### Minor Changes

- f31f5ee: Unit values are now exact, and the built-in units live in one table.
  
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

### Patch Changes

- Updated dependencies [f31f5ee]
  - @danielsimonjr/mathts-core@0.17.0

## 0.2.0

### Minor Changes

- 5b7ca6d: Add a conversion between the length-10 `Unit` exponent vector and the 7 SI base dimensions, exported from core and re-exported from units. `toSiDimensions` / `toSiDimensionVector` produce the BIPM order `[L, M, T, I, Θ, N, J]`; `fromSiDimensions` / `fromSiDimensionVector` go the other way. Nonzero angle, bit, or solid-angle exponents throw unless `ignoreExtra` is set.

### Patch Changes

- Updated dependencies [5b7ca6d]
  - @danielsimonjr/mathts-core@0.16.0

## 0.1.17

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
- Updated dependencies [a13ce7e]
  - @danielsimonjr/mathts-core@0.15.4

## 0.1.16

### Patch Changes

- Updated dependencies [57c8ffd]
  - @danielsimonjr/mathts-core@0.15.0

## 0.1.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.13.0

## 0.1.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.12.0

## 0.1.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.11.0

## 0.1.11

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0

## 0.1.10

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0

## 0.1.9

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0

## 0.1.8

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0

## 0.1.5

### Patch Changes

- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0

## 0.1.2

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.1

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS units / dimensional-analysis system as a focused package that re-exports the `Unit` class, the unit registry, SI prefixes, and the dimensional-analysis errors/types from `@danielsimonjr/mathts-core` (pinned `0.1.3`). Not a copy.
