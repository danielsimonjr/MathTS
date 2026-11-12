# Class Reference

The numeric and unit classes are exported from `@danielsimonjr/mathts-core` unless noted. The matrix, tensor, autograd, and parallel classes are exported from their own packages, as noted in each section.

---

## Complex

Represents a complex number `a + bi`.

```typescript
import { Complex } from '@danielsimonjr/mathts-core';

const c = new Complex(3, 4); // 3 + 4i
c.re; // 3
c.im; // 4
c.abs(); // 5  (magnitude)
c.arg(); // 0.9272952180016122  (angle in radians)
c.toString(); // '3 + 4i'
```

### Static factories

```typescript
import { Complex } from '@danielsimonjr/mathts-core';

Complex.fromPolar(5, Math.PI / 4); // magnitude 5, angle 45°
Complex.fromNumber(3); // Complex(3, 0)
Complex.fromJSON({ re: 3, im: 4 }); // deserialize
Complex.parse('3+4i'); // parse string
Complex.compare(a, b); // ordering comparison (number)
```

### Instance methods

| Method                                  | Returns      | Description                              |
| --------------------------------------- | ------------ | ---------------------------------------- |
| `add(other)`                            | `Complex`    | Addition                                 |
| `subtract(other)` (alias `sub`)         | `Complex`    | Subtraction                              |
| `multiply(other)` (alias `mul`)         | `Complex`    | Multiplication                           |
| `divide(other)` (alias `div`)           | `Complex`    | Division                                 |
| `neg()` (alias `negate()`)              | `Complex`    | Negation `-a - bi`                       |
| `conjugate()`                           | `Complex`    | Conjugate `a - bi`                       |
| `inverse()`                             | `Complex`    | Multiplicative inverse                   |
| `abs()`                                 | `number`     | Magnitude `sqrt(re² + im²)`              |
| `arg()`                                 | `number`     | Phase angle in radians                   |
| `sqrt()`                                | `Complex`    | Principal square root                    |
| `nthRoot(n)` `nthRoots(n)`              | `Complex`    | One principal root / all `n` roots       |
| `exp()` `log()`                         | `Complex`    | `e^z` / natural logarithm                |
| `pow(n)`                                | `Complex`    | Power (real or complex exponent)         |
| `sin()` `cos()` `tan()`                 | `Complex`    | Trigonometric                            |
| `sec()` `csc()` `cot()`                 | `Complex`    | Reciprocal trigonometric                 |
| `sinh()` `cosh()` `tanh()` `coth()`     | `Complex`    | Hyperbolic                               |
| `asin()` `acos()` `atan()`              | `Complex`    | Inverse trigonometric                    |
| `asinh()` `acosh()` `atanh()`           | `Complex`    | Inverse hyperbolic                       |
| `toPolar()`                             | `{ r, phi }` | Polar representation                     |
| `format(options?)`                      | `string`     | Formatted string (precision, notation)   |
| `equals(other, epsilon?)`               | `boolean`    | Equality within a tolerance              |
| `isReal()` `isImaginary()` `isZero()`   | `boolean`    | Component tests (optional epsilon)       |
| `isNaN()` `isInfinite()`                | `boolean`    | Non-finite tests                         |
| `round(d?)` `floor()` `ceil()` `sign()` | `Complex`    | Component-wise rounding                  |
| `clone()`                               | `Complex`    | Copy                                     |
| `toString()` `toJSON()`                 | —            | Render / `{ mathjs: 'Complex', re, im }` |

### Type guard

```typescript
import { Complex, isComplex } from '@danielsimonjr/mathts-core';
isComplex(new Complex(1, 2)); // true
```

Constants `I`, `COMPLEX_ZERO`, `COMPLEX_ONE`, and `COMPLEX_NEG_ONE` are listed in [Constants](constants.md#typed-singletons).

---

## Fraction

Represents an exact rational number as numerator/denominator `BigInt` pair.

```typescript
import { Fraction } from '@danielsimonjr/mathts-core';

const f = new Fraction(1n, 3n); // 1/3
f.numerator; // 1n
f.denominator; // 3n
f.toNumber(); // 0.3333333333333333
f.toString(); // '1/3'
```

### Static factories

```typescript
import { Fraction } from '@danielsimonjr/mathts-core';

Fraction.fromNumber(0.5); // Fraction(1, 2)
Fraction.fromJSON({ n: '1', d: '3' }); // Fraction(1, 3)
Fraction.parse('1/3'); // from a string
Fraction.fromDecimalString('0.(3)'); // repeating decimal -> 1/3
Fraction.fromContinuedFraction([0n, 2n]); // from a continued fraction
Fraction.compare(a, b); // ordering comparison (number)
```

### Instance methods

| Method                                                            | Returns             | Description                                       |
| ----------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| `add(other)`                                                      | `Fraction`          | Addition                                          |
| `subtract(other)` (alias `sub`)                                   | `Fraction`          | Subtraction                                       |
| `multiply(other)` (alias `mul`)                                   | `Fraction`          | Multiplication                                    |
| `divide(other)` (alias `div`)                                     | `Fraction`          | Division                                          |
| `negate()`                                                        | `Fraction`          | Negation                                          |
| `abs()`                                                           | `Fraction`          | Absolute value                                    |
| `inverse()`                                                       | `Fraction`          | Reciprocal                                        |
| `pow(n)`                                                          | `Fraction`          | Integer power                                     |
| `mod(other)`                                                      | `Fraction`          | Remainder                                         |
| `simplify()`                                                      | `Fraction`          | Reduce to lowest terms                            |
| `floor()` `ceil()` `round()` `trunc()`                            | `Fraction`          | Integer rounding                                  |
| `equals(other)` `compare(other)`                                  | boolean / number    | Comparison (also `lessThan`, `greaterThan`, …)    |
| `isZero()` `isPositive()` `isNegative()` `isInteger()` `isUnit()` | `boolean`           | Tests                                             |
| `sign()` `clone()`                                                | number / `Fraction` | Sign / copy                                       |
| `toNumber()`                                                      | `number`            | Convert to floating-point                         |
| `toDecimal(precision?)`                                           | `string`            | Decimal expansion (repeating part in parentheses) |
| `toLatex()`                                                       | `string`            | LaTeX `\frac{n}{d}`                               |
| `toMixed()`                                                       | object              | `{ whole, numerator, denominator }`               |
| `toContinuedFraction()`                                           | `bigint[]`          | Continued-fraction terms                          |
| `toJSON()`                                                        | object              | `{ mathjs: 'Fraction', n, d }`                    |

### Type guard

```typescript
import { Fraction, isFraction } from '@danielsimonjr/mathts-core';
isFraction(new Fraction(1n, 2n)); // true
```

Constants `FRACTION_ZERO`, `FRACTION_ONE`, `FRACTION_NEG_ONE`, `FRACTION_HALF`, `FRACTION_THIRD`, and `FRACTION_QUARTER` are listed in [Constants](constants.md#typed-singletons).

---

## BigNumber

Arbitrary-precision decimal number. Precision defaults to 64 significant digits.

The constructor is private — build instances via the static factories
(`BigNumber.parse` for strings, `BigNumber.fromNumber` for JS numbers).

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

const b = BigNumber.parse('3.14159265358979323846264338327950288');
b.toString(); // full precision string
b.toNumber(); // 3.141592653589793 (JavaScript number — loses precision)
b.toFixed(10); // '3.1415926536'
```

### Static factories

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

BigNumber.parse('1.5e-10'); // from a string (preserves full precision)
BigNumber.fromNumber(0.5); // from a JS number
BigNumber.fromBigInt(10n ** 30n); // from a bigint
BigNumber.fromJSON({ value: '3.14' }); // deserialize (or pass a toJSON() result)
BigNumber.config({ precision: 128 }); // set global precision
BigNumber.resetConfig(); // restore the default configuration
BigNumber.compare(a, b); // ordering comparison (number)
```

### Instance methods

| Method                                                                                       | Returns                       | Description                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `add(other)`                                                                                 | `BigNumber`                   | Addition                                        |
| `subtract(other)` (alias `sub`)                                                              | `BigNumber`                   | Subtraction                                     |
| `multiply(other)` (aliases `mul`, `times`)                                                   | `BigNumber`                   | Multiplication                                  |
| `divide(other)` (alias `div`)                                                                | `BigNumber`                   | Division                                        |
| `negate()` `abs()`                                                                           | `BigNumber`                   | Negation / absolute value                       |
| `pow(n)`                                                                                     | `BigNumber`                   | Integer power                                   |
| `sqrt()` `cbrt()` `exp()` `ln()`                                                             | `BigNumber`                   | Roots, exponential, natural logarithm           |
| `mod(other)`                                                                                 | `BigNumber`                   | Remainder                                       |
| `sin()` `cos()` `tan()`                                                                      | `BigNumber`                   | Trigonometric (arbitrary precision)             |
| `asin()` `acos()` `atan()`                                                                   | `BigNumber`                   | Inverse trigonometric                           |
| `sinh()` `cosh()` `tanh()`                                                                   | `BigNumber`                   | Hyperbolic                                      |
| `asinh()` `acosh()` `atanh()`                                                                | `BigNumber`                   | Inverse hyperbolic                              |
| `hypot(other)`                                                                               | `BigNumber`                   | `sqrt(a² + b²)`                                 |
| `round(dp?, mode?)` `roundToPrecision(p?)`                                                   | `BigNumber`                   | Rounding to decimal places / significant digits |
| `floor()` `ceil()` `trunc()`                                                                 | `BigNumber`                   | Integer rounding                                |
| `toFixed(n)`                                                                                 | `string`                      | Fixed-point notation                            |
| `toExponential(n)`                                                                           | `string`                      | Exponential notation                            |
| `toPrecision(n)`                                                                             | `string`                      | Significant-digit notation                      |
| `toSignificantDigits(n?)`                                                                    | `BigNumber`                   | Round to significant digits                     |
| `toBigInt()`                                                                                 | `bigint`                      | Truncate to a bigint                            |
| `toBinary()` `toOctal()` `toHexadecimal()`                                                   | `string`                      | Radix strings                                   |
| `equals(o)` `lessThan(o)` `greaterThan(o)` `compareTo(o)`                                    | boolean / number              | Comparisons (also `…OrEqual` variants)          |
| `isNaN()` `isFinite()` `isInfinite()` `isZero()` `isPositive()` `isNegative()` `isInteger()` | `boolean`                     | Tests                                           |
| `sign()` `clone()` `e`                                                                       | number / `BigNumber` / number | Sign, copy, decimal exponent (getter)           |
| `toJSON()`                                                                                   | object                        | `{ mathjs: 'BigNumber', value }`                |

### Type guard

```typescript
import { isBigNumber, BigNumber } from '@danielsimonjr/mathts-core';
isBigNumber(BigNumber.parse('1')); // true
```

Constants `BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_NEG_ONE`, `BIGNUMBER_TEN`, `BIGNUMBER_PI`, `BIGNUMBER_E`, `BIGNUMBER_LN2`, and `BIGNUMBER_LN10` are listed in [Constants](constants.md#bignumber-constants).

---

## Dual

Forward-mode automatic differentiation. A dual number carries a `value` and its
first derivative `deriv` (the `ε` coefficient); evaluating a function built from
the overloaded elementary `functions` on `Dual.variable(x)` propagates the
derivative exactly — no finite differences.

```typescript
import { Dual } from '@danielsimonjr/mathts-core';

const x = Dual.variable(2); // value 2, derivative 1 (point of differentiation)
x.sin().deriv; // cos(2) = -0.4161468365471424
x.value; // 2
```

### Static factories and constructor

```typescript
import { Dual } from '@danielsimonjr/mathts-core';

new Dual(value, deriv); // explicit value and derivative (deriv defaults to 0)
Dual.constant(5); // value 5, derivative 0 (a constant)
Dual.variable(2); // value 2, derivative 1 (the variable to differentiate w.r.t.)
```

### Instance methods

| Method                              | Returns  | Description                         |
| ----------------------------------- | -------- | ----------------------------------- |
| `add(o)` `sub(o)` `mul(o)` `div(o)` | `Dual`   | Arithmetic (propagates derivatives) |
| `neg()`                             | `Dual`   | Negation                            |
| `powConst(k)`                       | `Dual`   | Power with a constant real exponent |
| `pow(o)`                            | `Dual`   | General power `aᵇ`                  |
| `sin()` `cos()` `tan()`             | `Dual`   | Trigonometric                       |
| `exp()` `log()`                     | `Dual`   | Exponential / natural logarithm     |
| `sqrt()` `square()` `abs()`         | `Dual`   | Roots / square / absolute value     |
| `sinh()` `cosh()` `tanh()`          | `Dual`   | Hyperbolic                          |
| `toString()`                        | `string` | Render                              |

Elementary methods such as `sin()` apply `DUAL_UNARY_RULES` internally (`core/src/types/dual-rules.ts`); `unary` is not part of the public API.

### Type guard

```typescript
import { Dual, isDual } from '@danielsimonjr/mathts-core';
isDual(Dual.variable(1)); // true
```

> For differentiating ordinary expressions written with the `functions` API, use
> `derivativeAt` / `valueAndDerivativeAt` / `gradientAt` from
> `@danielsimonjr/mathts-functions` — they seed a `Dual` for you.

---

## Unit

A physical quantity with dimensional units (e.g. `5 m`, `9.8 m/s^2`). Same-dimension
addition and subtraction use the `add` / `subtract` functions from `@danielsimonjr/mathts-functions`, not methods on `Unit`. Instance methods combine or convert dimensions.

```typescript
import { Unit } from '@danielsimonjr/mathts-core';
import { add } from '@danielsimonjr/mathts-functions';

const d = new Unit(5, 'm');
d.to('cm').toString(); // '500 cm'
Unit.parse('9.8 m/s^2'); // an acceleration
add(new Unit(5, 'cm'), new Unit(3, 'mm')).toString(); // '5.300000000000001 cm'
d.toNumeric(); // 5 (value in base units)
d.equalBase(new Unit(1, 'cm')); // true — same dimension as meters
```

### Static factories

```typescript
import { Unit } from '@danielsimonjr/mathts-core';

Unit.parse('9.8 m/s^2'); // parse a unit string
Unit.fromJSON(new Unit(5, 'm').toJSON()); // deserialize the { mathjs: 'Unit', value, unit, fixPrefix, skipSimp } envelope
Unit.setUnitSystem('si'); // select the unit system used for conversions
```

`Unit.createUnit(defs, options?)` defines units, `Unit.deleteUnit(name)` removes one, `Unit.isValuelessUnit(name)` tests whether a name resolves to a known unit, and `Unit.PREFIXES` / `Unit.UNITS` expose the prefix and unit tables.

### Instance methods

| Method                                    | Returns              | Description                                            |
| ----------------------------------------- | -------------------- | ------------------------------------------------------ |
| `multiply(o)` `divide(o)` `divideInto(o)` | `Unit`               | Combine dimensions (or scale by a number)              |
| `pow(n)`                                  | `Unit`               | Raise to a power                                       |
| `to(target)` `toSI()`                     | `Unit`               | Convert units / SI base form                           |
| `toBest()` `simplify()`                   | `Unit`               | Readable prefix / simplified notation                  |
| `splitUnit(parts)`                        | `Unit[]`             | Split into component units                             |
| `format(opts?)` `formatUnits()`           | `string`             | Formatted quantity / unit string                       |
| `toNumeric(target?)`                      | `Numeric \| null`    | Numeric value in base units, or in `target` when given |
| `toNumber(target?)`                       | `number`             | Deprecated; use `toNumeric`                            |
| `equalBase(o)` `equals(o)`                | `boolean`            | Same dimension / value equality                        |
| `hasBase(base)` `valueType()`             | `boolean` / `string` | Dimension test / value kind                            |
| `abs()` `clone()` `valueOf()`             | `Unit` / number      | Absolute value, copy, numeric value                    |
| `toString()` `toJSON()`                   | —                    | Render / serialize                                     |

### Type guard

```typescript
import { Unit, isUnit } from '@danielsimonjr/mathts-core';
isUnit(new Unit(5, 'm')); // true
```

---

## Range

Numeric index range (`start`, `end`, `step`) for matrix indexing. Exported from `@danielsimonjr/mathts-core` as `Range` and `createRangeClass`.

```typescript
import { Range } from '@danielsimonjr/mathts-core';

const r = new Range(0, 10, 2);
r.toArray(); // [0, 2, 4, 6, 8] — end is exclusive
r.toJSON(); // { mathjs: 'Range', start: 0, end: 10, step: 2 }
```

### Static factories

```typescript
import { Range } from '@danielsimonjr/mathts-core';

Range.parse('0:2:11'); // 'start:step:end' string -> Range, or null when invalid
Range.fromJSON({ mathjs: 'Range', start: 0, end: 10, step: 2 });
```

### Instance methods

| Method                  | Returns               | Description                                   |
| ----------------------- | --------------------- | --------------------------------------------- |
| `size()`                | `number[]`            | Element count as a one-element array          |
| `min()` `max()`         | `number \| undefined` | Smallest / largest value in the range         |
| `forEach(cb)`           | `void`                | Call `cb(value, index, range)` for each value |
| `map(cb)`               | `T[]`                 | Map each value through `cb`                   |
| `toArray()` `valueOf()` | `number[]`            | Materialized values                           |
| `format(opts?)`         | `string`              | Formatted `start:step:end` string             |
| `clone()`               | `Range`               | Copy                                          |
| `toString()` `toJSON()` | —                     | Render / serialize                            |

Endpoints may be passed as `bigint` or `BigNumber` but are stored as `number` values inside the range.

---

## DenseMatrix

Row-major dense matrix. Exported from `@danielsimonjr/mathts-matrix` (and re-exported from `@danielsimonjr/mathts-compat`).

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const m = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
]);
m.size; // { rows: 2, cols: 3 }
m.get(0, 1); // 2
m.toArray(); // [[1, 2, 3], [4, 5, 6]]
```

### Static factories

| Method                                 | Returns       | Description                 |
| -------------------------------------- | ------------- | --------------------------- |
| `fromArray(rows)`                      | `DenseMatrix` | From a nested array         |
| `fromFlat(rows, cols, data)`           | `DenseMatrix` | From a flat row-major array |
| `zeros(rows, cols)` `ones(rows, cols)` | `DenseMatrix` | Filled with 0 / 1           |
| `fill(rows, cols, value)`              | `DenseMatrix` | Filled with `value`         |
| `identity(n)` `diag(values)`           | `DenseMatrix` | Identity / diagonal matrix  |
| `random(rows, cols)`                   | `DenseMatrix` | Uniform random entries      |

### Instance methods

| Method                                              | Returns                   | Description                               |
| --------------------------------------------------- | ------------------------- | ----------------------------------------- |
| `get(row, col)` `set(row, col, value)`              | number / `DenseMatrix`    | Element access (`set` returns the matrix) |
| `row(i)` `column(j)` `slice(spec)`                  | `DenseMatrix`             | Row, column, or sub-matrix                |
| `diagonal(k?)`                                      | `DenseMatrix`             | k-th diagonal                             |
| `add(o)` `subtract(o)`                              | `DenseMatrix`             | Element-wise add / subtract               |
| `multiplyElementwise(o)`                            | `DenseMatrix`             | Hadamard product                          |
| `multiply(o)`                                       | `DenseMatrix`             | Matrix product (pure JS path)             |
| `scale(k)` `negate()` `transpose()`                 | `DenseMatrix`             | Scalar multiple, negation, transpose      |
| `sum()` `mean()` `min()` `max()` `norm()` `trace()` | number                    | Reductions                                |
| `map(fn)` `forEach(fn)`                             | `DenseMatrix` / void      | Element callbacks `(value, row, col)`     |
| `toArray()` `toFlatArray()`                         | `number[][]` / `number[]` | Plain arrays                              |
| `clone()`                                           | `DenseMatrix`             | Copy                                      |
| `toSparse(dropTolerance?)`                          | `SparseMatrix`            | Convert to CSR                            |

### Matrix operations

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { multiply, det, inv } from '@danielsimonjr/mathts-functions';

const a = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);
const b = DenseMatrix.fromArray([
  [5, 6],
  [7, 8],
]);

multiply(a, b).toArray(); // [[19, 22], [43, 50]]
a.transpose().toArray(); // [[1, 3], [2, 4]]
det([
  [1, 2],
  [3, 4],
]); // -2
inv([
  [1, 2],
  [3, 4],
]); // [[-2, 1], [1.5, -0.5]]
```

`DenseMatrix.prototype.multiply` uses the pure JS path (no `backendManager`). WASM thresholds and decomposition behavior are described in [Matrices — Backends](../datatypes/matrices.md#backends).

### Serialization

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const m = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
]);
m.toArray(); // number[][] — plain nested array
DenseMatrix.fromArray(m.toArray()); // reconstruct from a nested array
```

---

## SparseMatrix

Compressed Sparse Row (CSR) format. Efficient for matrices where most elements are zero.

```typescript
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';

const dense = DenseMatrix.fromArray([
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3],
]);
const s = SparseMatrix.fromDense(dense);
s.size; // { rows: 3, cols: 3 }
s.get(1, 1); // 2
```

### Static factories

| Method                                           | Returns        | Description                                           |
| ------------------------------------------------ | -------------- | ----------------------------------------------------- |
| `fromDense(dense, dropTolerance?)`               | `SparseMatrix` | From a `DenseMatrix`, with an optional drop tolerance |
| `fromCOO(rows, cols, entries)`                   | `SparseMatrix` | From `{ row, col, value }` triples                    |
| `zeros(rows, cols)` `identity(n)` `diag(values)` | `SparseMatrix` | Construction helpers                                  |
| `validate(m)`                                    | `void`         | Checks the CSR invariants; throws on violation        |

### Properties and instance methods

| Member                                                        | Returns                 | Description                                                                           |
| ------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `nnz` `density` `sparsity` (getters)                          | number                  | Stored entries and fill ratios                                                        |
| `get(row, col)` `set(row, col, value)`                        | number / `SparseMatrix` | Element access                                                                        |
| `row(i)` `column(j)` `slice(spec)` `diagonal(k?)`             | `SparseMatrix`          | Views into the matrix                                                                 |
| `add(o)` `subtract(o)` `multiplyElementwise(o)` `multiply(o)` | `SparseMatrix`          | Arithmetic                                                                            |
| `scale(k)` `negate()` `transpose()`                           | `SparseMatrix`          | Scalar, negation, transpose                                                           |
| `sum()` `norm()` `trace()`                                    | number                  | Reductions                                                                            |
| `map(fn)` `mapNonZeros(fn)`                                   | `SparseMatrix`          | Callbacks `(value, row, col)`; `mapNonZeros` skips zeros                              |
| `toDense()` `toArray()` `toFlatArray()`                       | dense / arrays          | Convert out                                                                           |
| `getCSR()`                                                    | object                  | Copies as `{ values: Float64Array, colIndices: Int32Array, rowPointers: Int32Array }` |
| `clone()`                                                     | `SparseMatrix`          | Copy                                                                                  |

`SparseMatrix` extends the same `Matrix` base as `DenseMatrix`, so `size` and the shared interface work on both. For the rule of thumb on when sparse storage pays off, see [Matrices — SparseMatrix](../datatypes/matrices.md#sparsematrix).

---

## Tensor

Rank-N dense tensor, `Float64Array`-backed. Exported from `@danielsimonjr/mathts-tensor`.

```typescript
import { Tensor } from '@danielsimonjr/mathts-tensor';

const t = Tensor.fromNested(
  [
    [1, 2],
    [3, 4],
  ],
  [2, 2]
);
t.shape; // [2, 2]
t.add(t).toNested(); // [[2,4],[6,8]]
t.matMul(t).toNested(); // [[7,10],[15,22]]
t.transpose().toNested(); // [[1,3],[2,4]]

// flat construction (shape + Float64Array):
new Tensor([2, 3], Float64Array.of(1, 2, 3, 4, 5, 6)).toNested(); // [[1,2,3],[4,5,6]]
```

Fields: `shape` (`ReadonlyArray<number>`) and `data` (`Float64Array`, row-major).

### Static factories and helpers

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { Tensor } from '@danielsimonjr/mathts-tensor';

const nested = [
  [1, 2],
  [3, 4],
];
Tensor.fromNested(nested); // infers shape [2, 2]; explicit shape still accepted
Tensor.identity(3); // [[1,0,0],[0,1,0],[0,0,1]]
const m = DenseMatrix.fromArray(nested);
Tensor.fromDenseMatrix(m); // from a DenseMatrix
Tensor.broadcastShape([2, 1], [1, 3]); // [2, 3]
Tensor.sizeOf([2, 3]); // 6
Tensor.rowMajorStrides([2, 3]); // [3, 1]
```

### Instance methods

| Method                                                    | Returns               | Description                                        |
| --------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| `add(o)` `sub(o)` `mul(o)` `div(o)`                       | `Tensor`              | Element-wise (broadcasting; `o` may be a number)   |
| `neg()` `scale(k)` `map(fn)` `clone()`                    | `Tensor`              | Negation, scalar multiple, element map, copy       |
| `matMul(o)`                                               | `Tensor`              | Matrix product                                     |
| `tensordot(o, axes)` `contract(o)`                        | `Tensor`              | Tensor products over axes / shared labels          |
| `transpose(perm?)` `reshape(shape)`                       | `Tensor`              | Permute axes / reshape                             |
| `sum(axis?, opts?)` `mean(…)` `max(…)` `min(…)` `prod(…)` | `Tensor`              | Reductions (scalar or along axes; `opts.keepDims`) |
| `norm(opts?)`                                             | `Tensor`              | Vector / matrix norm (`p`, `axis`, `keepDims`)     |
| `normInf()`                                               | `number`              | Infinity norm                                      |
| `toNested()` `toDenseMatrix()`                            | array / `DenseMatrix` | Convert out                                        |

For automatic differentiation over tensors, see `@danielsimonjr/mathts-autograd`
(`TapedTensor`, reverse-mode; `DualTensor`, forward-mode).

---

## Autograd classes

Exported from `@danielsimonjr/mathts-autograd`. These are the classes behind the `reverseGrad` and `forwardGrad` entry points.

### Tape and TapedTensor (reverse mode)

A `Tape` records the operations on `TapedTensor` values; `backward` propagates a cotangent from an output to its inputs.

```typescript
import { Tape, TapedTensor } from '@danielsimonjr/mathts-autograd';
import { Tensor } from '@danielsimonjr/mathts-tensor';

const tape = new Tape();
const x = TapedTensor.fromTensorAsInput(Tensor.fromNested([1, 2, 3], [3]), tape);
const y = x.square().sum();
tape.backward(y.id, Float64Array.of(1));
Array.from(tape.getInputGrad(x.id) ?? []); // [2, 4, 6]
```

| Member (`Tape`)                          | Returns                     | Description                                 |
| ---------------------------------------- | --------------------------- | ------------------------------------------- |
| `backward(outputId, outputGrad)`         | `void`                      | Propagate a cotangent back through the tape |
| `getInputGrad(id)`                       | `Float64Array \| undefined` | Gradient accumulated for an input id        |
| `allocate(size)` `record(...)` `reset()` | —                           | Low-level allocation, recording, and reuse  |

| Member (`TapedTensor`)                                                               | Returns                                                 | Description                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------- |
| `TapedTensor.fromTensorAsInput(t, tape)`                                             | `TapedTensor`                                           | Wrap a `Tensor` as a differentiable input |
| `shape` `primal` `tape` `id` `data`                                                  | —                                                       | Fields (`data` is the primal values)      |
| `toPrimalTensor()`                                                                   | `Tensor`                                                | Detach to a plain `Tensor`                |
| `add` `sub` `mul` `divide` `scale` `contract` `matmul` `tensordot`                   | `TapedTensor`                                           | Binary and linear ops                     |
| `sum` `mean` `prod` `max` `min` `norm`                                               | `TapedTensor`                                           | Reductions                                |
| `exp` `log` `sin` `cos` `tan` `sqrt` `square` `pow` `reciprocal` `abs` `sign` `cbrt` | `TapedTensor`                                           | Elementwise ops                           |
| `sinh` `cosh` `tanh` `asin` `acos` `atan` `asinh` `acosh` `atanh`                    | `TapedTensor`                                           | Hyperbolic and inverse functions          |
| `svd()` `eig({ symmetric })`                                                         | `{ U, S, V }` / `{ eigvals, eigvecs }` of `TapedTensor` | Decompositions with gradients             |

### DualTensor (forward mode)

A `DualTensor` carries a primal and a tangent array of the same length. Seed a direction with `unitAt`.

```typescript
import { DualTensor } from '@danielsimonjr/mathts-autograd';
import { Tensor } from '@danielsimonjr/mathts-tensor';

const t = Tensor.fromNested([1, 2, 3], [3]);
const d = DualTensor.unitAt(t, 0); // tangent is 1 at flat index 0
d.exp().toTangentTensor(); // derivative of exp with respect to element 0
```

| Member                                                                         | Returns      | Description                                |
| ------------------------------------------------------------------------------ | ------------ | ------------------------------------------ |
| `new DualTensor(shape, primal, tangent)`                                       | `DualTensor` | Constructor (lengths must match)           |
| `DualTensor.fromTensor(t)`                                                     | `DualTensor` | Lift with a zero tangent                   |
| `DualTensor.unitAt(t, i)`                                                      | `DualTensor` | Lift with a unit tangent at flat index `i` |
| `toPrimalTensor()` `toTangentTensor()`                                         | `Tensor`     | Extract the primal or tangent              |
| `add` `sub` `mul` `divide` `scale`                                             | `DualTensor` | Arithmetic with tangent propagation        |
| `exp` `log` `sin` `cos` `tan` `sqrt` `square` `reciprocal` `abs` `cbrt` `sign` | `DualTensor` | Elementwise ops                            |
| `sinh` `cosh` `tanh` `asin` `acos` `atan` `asinh` `acosh` `atanh`              | `DualTensor` | Hyperbolic and inverse functions           |
| `pow(k)`                                                                       | `DualTensor` | Power with a numeric exponent              |

---

## Parallel classes

Exported from `@danielsimonjr/mathts-parallel`.

### ComputePool

Threshold-based dispatch over a worker pool. Each operation runs sequentially below its threshold and fans out to workers above it. Every operation returns a `ParallelResult<T>` with `result`, `duration`, `chunks`, and `parallelized`. A shared default instance is exported as `computePool`.

```typescript
import { ComputePool, computePool } from '@danielsimonjr/mathts-parallel';

const pool = new ComputePool({}); // optional Partial<ComputePoolConfig>
await pool.initialize(); // start the workers before a parallel dispatch
const r = await pool.sum(new Float64Array([1, 2, 3]));
r.result; // 6

await computePool.sum(new Float64Array([1, 2, 3])); // same call on the shared instance
```

| Member                                                                      | Returns                      | Description                        |
| --------------------------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| `initialize()`                                                              | `Promise<void>`              | Start the workers                  |
| `isReady()`                                                                 | `boolean`                    | Whether workers are ready          |
| `shouldParallelize(n, op?, force?)`                                         | `boolean`                    | Dispatch decision for an operation |
| `stats()`                                                                   | `PoolStats`                  | Pool statistics                    |
| `exec(method, params, options?)`                                            | `Promise<T>`                 | Run a named worker method directly |
| `sum` `prod` `mean` `std` `variance` `norm` `minMax` `distance` `histogram` | `Promise<ParallelResult<…>>` | Reductions                         |
| `dot` `matmul` `matvec` `outer` `transpose` `tensordot`                     | `Promise<ParallelResult<…>>` | Linear algebra                     |
| `add` `subtract` `multiply` `divide` `pow` `scale` `elementwise`            | `Promise<ParallelResult<…>>` | Element-wise ops                   |
| `abs` `sqrt` `exp` `log` `sin` `cos` `tan` `negate` `square` `sign` `unary` | `Promise<ParallelResult<…>>` | Unary ops                          |
| `map` `reduce` `filter` `find` `sort`                                       | `Promise<ParallelResult<…>>` | Callback-style operations          |

`DEFAULT_POOL_CONFIG`, `DEFAULT_THRESHOLD_BY_OP`, and `resolveOpThreshold` expose the defaults that drive dispatch.

### WorkerPool

Low-level pool of `Worker` instances running one script. Use `ComputePool` unless you need a custom worker script.

```typescript
import { WorkerPool } from '@danielsimonjr/mathts-parallel';

const pool = new WorkerPool('/workers/matrix.worker.js', 4); // worker script and max workers
const out = await pool.execute(payload, undefined, 5000); // payload is the worker's input
await pool.terminate();
```

| Member                                            | Returns         | Description                                                                              |
| ------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `new WorkerPool(workerScript, maxWorkers?)`       | `WorkerPool`    | Constructor                                                                              |
| `execute(data, transferables?, timeoutMs?)`       | `Promise<R>`    | Run one task; `timeoutMs` terminates and replaces a hung worker (omit or `0` to disable) |
| `terminate()`                                     | `Promise<void>` | Stop all workers                                                                         |
| `activeTaskCount` `queuedTaskCount` `workerCount` | number          | Pool state (getters)                                                                     |
