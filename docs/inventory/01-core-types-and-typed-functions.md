# Core Types & Typed Functions Inventory

Generated: 2026-04-03

---

## Core Types

### Complex (`core/src/types/complex.ts`)

- Lines: 641
- Instance methods: `fromPolar`, `fromNumber`, `fromJSON`, `parse`, `compare`, `valueOf`, `toString`, `toJSON`, `toPolar`, `format`, `conjugate`, `abs`, `range`, `abs2`, `add`, `subtract`, `multiply`, `divide`, `negate`, `inverse`, `sqrt`, `nthRoot`, `nthRoots`, `exp`, `log`, `log10`, `log2`, `pow`, `sin`, `cos`, `tan`, `cot`, `sec`, `csc`, `sinh`, `cosh`, `tanh`, `coth`, `sech`, `csch`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `equals`, `isReal`, `isImaginary`, `isZero`, `isNaN`, `isInfinite`, `clone`, `round`, `floor`, `ceil`, `sign`
- Static methods: `fromPolar`, `fromNumber`, `fromJSON`, `parse`, `compare`
- Total method count: 60

### Fraction (`core/src/types/fraction.ts`)

- Lines: 609
- Instance methods: `fromNumber`, `fromDecimalString`, `parse`, `fromJSON`, `compare`, `valueOf`, `toString`, `toJSON`, `toNumber`, `toDecimal`, `toLatex`, `toMixed`, `add`, `subtract`, `multiply`, `divide`, `negate`, `abs`, `inverse`, `pow`, `mod`, `equals`, `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, `compareTo`, `simplify`, `isZero`, `isPositive`, `isNegative`, `isInteger`, `isUnit`, `floor`, `ceil`, `round`, `trunc`, `sign`, `clone`, `gcd`, `toContinuedFraction`, `fromContinuedFraction`, `mediant`
- Static methods: `fromNumber`, `fromDecimalString`, `parse`, `fromJSON`, `compare`, `fromContinuedFraction`
- Total method count: 43

### BigNumber (`core/src/types/bignumber.ts`)

- Lines: 822
- Instance methods: `fromNumber`, `parse`, `fromBigInt`, `fromJSON`, `config`, `resetConfig`, `compare`, `compareMagnitude`, `valueOf`, `toString`, `toJSON`, `toFixed`, `toFixedInternal`, `repeat`, `slice`, `toExponential`, `toPrecision`, `toBigInt`, `add`, `subtract`, `multiply`, `divide`, `negate`, `abs`, `pow`, `sqrt`, `equals`, `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, `compareTo`, `round`, `shouldRound`, `roundToPrecision`, `floor`, `ceil`, `trunc`, `isNaN`, `isFinite`, `isInfinite`, `isZero`, `isPositive`, `isNegative`, `isInteger`, `sign`, `clone`, `ensureBigNumber`, `alignExponents`, `normalize`
- Static methods: `fromNumber`, `parse`, `fromBigInt`, `fromJSON`, `config`, `resetConfig`, `compare`, `compareMagnitude`
- Total method count: 56
- Notable gap: No transcendental/trig methods (`exp`, `ln`, `log10`, `log2`, `cbrt`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`) — arithmetic only.

---

## Active Typed Functions (`functions/src/typed/`)

### `arithmetic.ts`

- Lines: 994
- Exports: `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`, `sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `mod`, `gcd`, `lcm`, `xgcd`, `norm`, `sinh`, `cosh`, `tanh`, `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot`, `shouldParallelize`, `getComputePool`, `typedArithmetic`
- Typed functions (dispatched): `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`, `sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `mod`, `gcd`, `lcm`, `xgcd`, `norm`, `sinh`, `cosh`, `tanh`, `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot`, `typedArithmetic`
- Export count: 48

### `trigonometry.ts`

- Lines: 270
- Exports: `sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `atan2`, `acsc`, `asec`, `acot`, `asinh`, `acosh`, `atanh`, `toRadians`, `toDegrees`, `hypot`, `typedTrigonometry`
- Typed functions (dispatched): same as exports (all typed)
- Export count: 20

### `statistics.ts`

- Lines: 740
- Exports: `NormalizationType` (enum), `parallelStatSum`, `parallelStatMean`, `parallelStatVariance`, `parallelStatStd`, `parallelStatMin`, `parallelStatMax`, `parallelStatMinMax`, `parallelStatMedian`, `parallelStatMode`, `parallelStatProd`, `parallelStatNorm`, `parallelStatDistance`, `parallelStatCorr`, `parallelStatMAD`, `parallelStatCumsum`, `parallelStatQuantile`, `parallelStatHistogram`, `typedStatistics`
- Typed functions (dispatched): all `parallelStat*` + `typedStatistics`
- Export count: 19

### `signal.ts`

- Lines: 412
- Exports: `parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `typedSignal`
- Typed functions (dispatched): all 8 exports
- Export count: 8

---

## Type Gaps (methods called but missing from core types)

These are method calls found in `functions/src/typed/` that reference methods that do not exist on the targeted core type. They will cause runtime errors or TypeScript errors for those overloads.

| Method Called | Called On | File:Line(s) | Exists on Type? | Closest Existing Method |
|---|---|---|---|---|
| `neg()` | `Complex` | arithmetic.ts:214 | NO | `negate()` |
| `neg()` | `Fraction` | arithmetic.ts:215 | NO | `negate()` |
| `neg()` | `BigNumber` | arithmetic.ts:216 | NO | `negate()` |
| `cbrt()` | `BigNumber` | arithmetic.ts:335 | NO | none — not implemented |
| `ln()` | `BigNumber` | arithmetic.ts:372 | NO | none — not implemented |
| `reciprocal()` | `Complex` | trigonometry.ts:84,93,102,160,168,176 | NO | `inverse()` |
| `div()` | `BigNumber` | trigonometry.ts:85,94,103 | NO | `divide()` |
| `sin()` | `BigNumber` | trigonometry.ts:40,85,94,103 | NO | none — not implemented |
| `cos()` | `BigNumber` | trigonometry.ts:55,94 | NO | none — not implemented |
| `tan()` | `BigNumber` | trigonometry.ts:70,103 | NO | none — not implemented |
| `asin()` | `BigNumber` | trigonometry.ts:122 | NO | none — not implemented |
| `acos()` | `BigNumber` | trigonometry.ts:136 | NO | none — not implemented |
| `atan()` | `BigNumber` | trigonometry.ts:145 | NO | none — not implemented |
| `asinh()` | `BigNumber` | trigonometry.ts:189 | NO | none — not implemented |
| `acosh()` | `BigNumber` | trigonometry.ts:198 | NO | none — not implemented |
| `atanh()` | `BigNumber` | trigonometry.ts:207 | NO | none — not implemented |
| `exp()` | `BigNumber` | arithmetic.ts:357 | NO | none — not implemented |
| `log10()` | `BigNumber` | arithmetic.ts:388 | NO | none — not implemented |
| `log2()` | `BigNumber` | arithmetic.ts:397 | NO | none — not implemented |
| `sinh()` | `BigNumber` | arithmetic.ts:577 | NO | none — not implemented |
| `cosh()` | `BigNumber` | arithmetic.ts:586 | NO | none — not implemented |
| `tanh()` | `BigNumber` | arithmetic.ts:595 | NO | none — not implemented |
| `mod()` | `BigNumber` | arithmetic.ts:469 | NO | none — not implemented |

### Summary by gap type

**Wrong method name (rename fix):**
- `neg()` → should be `negate()` on Complex, Fraction, BigNumber (arithmetic.ts:214-216)
- `reciprocal()` → should be `inverse()` on Complex (trigonometry.ts:84,93,102,160,168,176)
- `div()` → should be `divide()` on BigNumber (trigonometry.ts:85,94,103)

**Missing BigNumber transcendental methods (implementation needed):**
BigNumber covers only basic arithmetic. All transcendental and trigonometric operations are unimplemented. Affected functions and the methods they require:
- `exp` function → `BigNumber.exp()`
- `log` function → `BigNumber.ln()`
- `log10` function → `BigNumber.log10()`
- `log2` function → `BigNumber.log2()`
- `cbrt` function → `BigNumber.cbrt()`
- `mod` function → `BigNumber.mod()`
- `sinh`, `cosh`, `tanh` functions → `BigNumber.sinh()`, `.cosh()`, `.tanh()`
- `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh` (trig) → 9 BigNumber trig methods missing

---

## Cross-Package Dependencies

Extracted from `tools/inventory.py cross-deps`:

```
core           → (no @mathts/* deps)   [1 self-ref: typed-function]
matrix         → @danielsimonjr/mathts-core (×5), @danielsimonjr/mathts-parallel (×3)
functions      → @danielsimonjr/mathts-core (×4), @danielsimonjr/mathts-parallel (×4)
parallel       → @danielsimonjr/mathts-workerpool (×1), @danielsimonjr/mathts-parallel (×1, internal)
compat         → @danielsimonjr/mathts-core (×3), @danielsimonjr/mathts-compat (×2, internal),
                 @danielsimonjr/mathts-matrix (×2), @danielsimonjr/mathts-parallel (×1), @danielsimonjr/mathts-functions (×1)
```

Dependency order (build sequence): `typed-function` → `core` → `matrix`/`parallel` → `functions` → `compat`
