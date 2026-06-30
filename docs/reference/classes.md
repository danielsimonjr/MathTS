# Class Reference

All classes are exported from `@danielsimonjr/mathts-core` unless noted.

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
Complex.fromPolar(5, Math.PI / 4); // magnitude 5, angle 45°
Complex.fromNumber(3); // Complex(3, 0)
Complex.fromJSON({ re: 3, im: 4 }); // deserialize
Complex.parse('3+4i'); // parse string
```

### Instance methods

| Method                  | Returns      | Description                     |
| ----------------------- | ------------ | ------------------------------- |
| `add(other)`            | `Complex`    | Addition                        |
| `sub(other)`            | `Complex`    | Subtraction                     |
| `mul(other)`            | `Complex`    | Multiplication                  |
| `div(other)`            | `Complex`    | Division                        |
| `abs()`                 | `number`     | Magnitude `sqrt(re² + im²)`     |
| `arg()`                 | `number`     | Phase angle in radians          |
| `conj()`                | `Complex`    | Conjugate `a - bi`              |
| `neg()`                 | `Complex`    | Negation `-a - bi`              |
| `sqrt()`                | `Complex`    | Square root                     |
| `exp()`                 | `Complex`    | `e^z`                           |
| `log()`                 | `Complex`    | Natural logarithm               |
| `pow(n)`                | `Complex`    | Power                           |
| `sin()` `cos()` `tan()` | `Complex`    | Trigonometric                   |
| `toPolar()`             | `{ r, phi }` | Polar representation            |
| `toJSON()`              | object       | `{ mathjs: 'Complex', re, im }` |

### Type guard

```typescript
import { isComplex } from '@danielsimonjr/mathts-core';
isComplex(new Complex(1, 2)); // true
```

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
Fraction.fromNumber(0.5); // Fraction(1, 2)
Fraction.fromJSON({ n: '1', d: '3' }); // Fraction(1, 3)
```

### Instance methods

| Method       | Returns    | Description                    |
| ------------ | ---------- | ------------------------------ |
| `add(other)` | `Fraction` | Addition                       |
| `sub(other)` | `Fraction` | Subtraction                    |
| `mul(other)` | `Fraction` | Multiplication                 |
| `div(other)` | `Fraction` | Division                       |
| `neg()`      | `Fraction` | Negation                       |
| `abs()`      | `Fraction` | Absolute value                 |
| `toNumber()` | `number`   | Convert to floating-point      |
| `toJSON()`   | object     | `{ mathjs: 'Fraction', n, d }` |

### Type guard

```typescript
import { isFraction } from '@danielsimonjr/mathts-core';
isFraction(new Fraction(1n, 2n)); // true
```

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
BigNumber.parse('1.5e-10'); // from a string (preserves full precision)
BigNumber.fromNumber(0.5); // from a JS number
BigNumber.fromJSON({ mathjs: 'BigNumber', value: '3.14' }); // deserialize
BigNumber.config({ precision: 128 }); // set global precision
```

### Instance methods

| Method                  | Returns     | Description                         |
| ----------------------- | ----------- | ----------------------------------- |
| `add(other)`            | `BigNumber` | Addition                            |
| `sub(other)`            | `BigNumber` | Subtraction                         |
| `mul(other)`            | `BigNumber` | Multiplication                      |
| `div(other)`            | `BigNumber` | Division                            |
| `sqrt()`                | `BigNumber` | Square root                         |
| `pow(n)`                | `BigNumber` | Power                               |
| `abs()`                 | `BigNumber` | Absolute value                      |
| `sin()` `cos()` `tan()` | `BigNumber` | Trigonometric (arbitrary precision) |
| `toFixed(n)`            | `string`    | Fixed-point notation                |
| `toExponential(n)`      | `string`    | Exponential notation                |
| `toJSON()`              | object      | `{ mathjs: 'BigNumber', value }`    |

### Type guard

```typescript
import { isBigNumber } from '@danielsimonjr/mathts-core';
isBigNumber(new BigNumber('1')); // true
```

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

### Static factories

```typescript
Dual.constant(5); // value 5, derivative 0 (a constant)
Dual.variable(2); // value 2, derivative 1 (the variable to differentiate w.r.t.)
```

### Instance methods

| Method                              | Returns | Description                          |
| ----------------------------------- | ------- | ------------------------------------ |
| `add(o)` `sub(o)` `mul(o)` `div(o)` | `Dual`  | Arithmetic (propagates derivatives)  |
| `neg()`                             | `Dual`  | Negation                             |
| `powConst(k)`                       | `Dual`  | Power with a constant real exponent  |
| `pow(o)`                            | `Dual`  | General power `aᵇ`                   |
| `sin()` `cos()` `tan()`             | `Dual`  | Trigonometric                        |
| `exp()` `log()`                     | `Dual`  | Exponential / natural logarithm      |
| `sqrt()` `square()` `abs()`         | `Dual`  | Roots / square / absolute value      |
| `sinh()` `cosh()` `tanh()`          | `Dual`  | Hyperbolic                           |

### Type guard

```typescript
import { isDual } from '@danielsimonjr/mathts-core';
isDual(Dual.variable(1)); // true
```

> For differentiating ordinary expressions written with the `functions` API, use
> `derivativeAt` / `valueAndDerivativeAt` / `gradientAt` from
> `@danielsimonjr/mathts-functions` — they seed a `Dual` for you.

---

## Unit

A physical quantity with dimensional units (e.g. `5 m`, `9.8 m/s^2`). Same-dimension
units add and subtract; multiplication, division, and powers combine dimensions.

```typescript
import { Unit } from '@danielsimonjr/mathts-core';

const d = new Unit(5, 'm');
d.to('cm').toString(); // '500 cm'
Unit.parse('9.8 m/s^2'); // an acceleration
new Unit(5, 'cm').add(new Unit(3, 'mm')).toString(); // '5.3 cm'
```

### Static factories

```typescript
Unit.parse('9.8 m/s^2'); // parse a unit string
Unit.fromJSON({ mathts: 'Unit', value: 5, notation: 'm' }); // deserialize
```

### Instance methods

| Method                              | Returns   | Description                              |
| ----------------------------------- | --------- | ---------------------------------------- |
| `add(o)` `sub(o)`                   | `Unit`    | Same-dimension addition / subtraction    |
| `mul(o)` `div(o)`                   | `Unit`    | Combine dimensions (or scale by a number) |
| `pow(n)`                            | `Unit`    | Raise to a power                         |
| `to(target)`                        | `Unit`    | Convert to another unit of equal dimension |
| `toBest()`                          | `Unit`    | Auto-select the most readable prefix     |
| `equals(o)` `dimensionsEqual(o)`    | `boolean` | Equality / dimensional compatibility     |
| `toString()` `toJSON()`             | —         | Render / serialize                       |

### Type guard

```typescript
import { isUnit } from '@danielsimonjr/mathts-core';
isUnit(new Unit(5, 'm')); // true
```

---

## DenseMatrix

Row-major dense matrix. Exported from `@danielsimonjr/mathts-matrix` (and re-exported from `@danielsimonjr/mathts-compat`).

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const m = new DenseMatrix([
  [1, 2, 3],
  [4, 5, 6],
]);
m.size(); // [2, 3]
m.get([0, 1]); // 2
m.toArray(); // [[1,2,3],[4,5,6]]
```

### Matrix operations

```typescript
import { multiply, transpose, det, inv } from '@danielsimonjr/mathts-functions';

const a = new DenseMatrix([
  [1, 2],
  [3, 4],
]);
const b = new DenseMatrix([
  [5, 6],
  [7, 8],
]);

multiply(a, b); // DenseMatrix [[19,22],[43,50]]
transpose(a); // DenseMatrix [[1,3],[2,4]]
det(a); // -2
inv(a); // DenseMatrix [[-2, 1],[1.5, -0.5]]
```

### Backend selection

Operations automatically use the fastest available backend:

| Threshold          | Backend                             |
| ------------------ | ----------------------------------- |
| Default            | JSBackend (pure TypeScript)         |
| > 1,000 elements   | WASMBackend (SIMD-accelerated)      |
| > 100,000 elements | GPUBackend (WebGPU compute shaders) |

### Serialization

```typescript
m.toArray(); // number[][] — plain nested array
DenseMatrix.fromArray(m.toArray()); // reconstruct from a nested array
```

---

## SparseMatrix

Compressed Sparse Row (CSR) format. Efficient for matrices where most elements are zero.

```typescript
import { SparseMatrix } from '@danielsimonjr/mathts-matrix';

const s = new SparseMatrix([
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3],
]);
s.size(); // [3, 3]
s.get([1, 1]); // 2
```

SparseMatrix implements the same `Matrix` interface as `DenseMatrix`. Prefer it when density is below ~25%.

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

### Static factories

```typescript
Tensor.fromNested(nested, shape); // from nested arrays (shape required)
Tensor.identity(3); // [[1,0,0],[0,1,0],[0,0,1]]
Tensor.fromDenseMatrix(m); // from a DenseMatrix
Tensor.einsum(spec, ...tensors); // Einstein summation
```

### Instance methods

| Method                                    | Returns          | Description                                |
| ----------------------------------------- | ---------------- | ------------------------------------------ |
| `add(o)` `sub(o)` `mul(o)`                | `Tensor`         | Element-wise (broadcasting)                |
| `scale(k)`                                | `Tensor`         | Multiply by a scalar                       |
| `matMul(o)` `tensordot(o, …)` `contract(…)` | `Tensor`       | Matrix / tensor products                   |
| `transpose(…)` `reshape(shape)`           | `Tensor`         | Reshape / permute axes                     |
| `sum()` `mean()` `max()` `min()` `prod()` | `Tensor`         | Reductions (scalar or along axes)          |
| `norm()` `normInf()`                      | `number`         | Vector / matrix norms                      |
| `toNested()` `toDenseMatrix()`            | array / `DenseMatrix` | Convert out                            |

For automatic differentiation over tensors, see `@danielsimonjr/mathts-autograd`
(`TapedTensor`, reverse-mode; `DualTensor`, forward-mode).
