# Complex Numbers

MathTS provides a `Complex` class for arithmetic with complex numbers. In mathematics, a complex number has the form `a + bi`, where `a` is the real part, `b` is the imaginary part, and `i` is the imaginary unit satisfying `i² = −1`.

Complex numbers are commonly used in signal processing, control theory, and applied mathematics. MathTS implements `Complex` as a native TypeScript class — no external library dependency.

## Construction

Import `Complex` from `@danielsimonjr/mathts-core`:

```ts
import { Complex } from '@danielsimonjr/mathts-core';

// Cartesian form: new Complex(re, im)
const a = new Complex(3, 4); // 3 + 4i
const b = new Complex(2, -1); // 2 - i
const c = new Complex(5); // 5 (purely real)

// Polar form: Complex.fromPolar(r, theta)
const d = Complex.fromPolar(1, Math.PI / 2); // approximately 0 + 1i

// From a real number
const e = Complex.fromNumber(7); // 7 + 0i

// Parse from string
const f = Complex.parse('3+4i'); // 3 + 4i
const g = Complex.parse('2-1i'); // 2 - i
const h = Complex.parse('-4i'); // -4i
```

## Properties

```ts
const z = new Complex(3, 4);

z.re; // 3 (real part)
z.im; // 4 (imaginary part)
z.type; // 'Complex'
```

`Complex` instances are **immutable** — all operations return new instances.

## Instance Methods

### Arithmetic

```ts
const a = new Complex(1, 2);
const b = new Complex(3, 4);

a.add(b); // Complex 4 + 6i
a.subtract(b); // Complex -2 - 2i
a.multiply(b); // Complex -5 + 10i
a.divide(b); // Complex 0.44 + 0.08i
a.negate(); // Complex -1 - 2i
```

### Magnitude and Argument

```ts
const z = new Complex(3, 4);

z.abs(); // 5          (magnitude: √(3² + 4²))
z.abs2(); // 25         (magnitude squared)
z.arg(); // 0.9272952... (phase angle in radians)
z.toPolar(); // { r: 5, phi: 0.9272952... }
```

### Conjugate and Inverse

```ts
const z = new Complex(3, 4);

z.conjugate(); // Complex 3 - 4i
z.inverse(); // Complex 1/z = z̄/|z|²
```

### Square Root and Exponential

```ts
new Complex(-4, 0).sqrt(); // Complex 0 + 2i
new Complex(0, Math.PI).exp(); // Complex ≈ -1 + 0i  (Euler's formula)
new Complex(1, 0).log(); // Complex 0 + 0i
```

### Comparison and Equality

```ts
const a = new Complex(1, 2);
const b = new Complex(1, 2);

a.equals(b); // true
Complex.compare(a, b); // 0  (lexicographic: re first, then im)
```

## Static Factory Methods

| Method                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `Complex.fromPolar(r, theta)`  | Polar form: `r * e^(i*theta)`              |
| `Complex.fromNumber(n)`        | Real number as Complex                     |
| `Complex.fromJSON({ re, im })` | Deserialize from plain object              |
| `Complex.parse(str)`           | Parse `'3+4i'`, `'-2i'`, `'5'` etc.        |
| `Complex.compare(a, b)`        | Lexicographic comparison, returns −1, 0, 1 |

## Predefined Constants

```ts
import { I, COMPLEX_ZERO, COMPLEX_ONE, COMPLEX_NEG_ONE } from '@danielsimonjr/mathts-core';

I; // Complex 0 + 1i
COMPLEX_ZERO; // Complex 0 + 0i
COMPLEX_ONE; // Complex 1 + 0i
COMPLEX_NEG_ONE; // Complex -1 + 0i
```

## Type Guard

```ts
import { isComplex } from '@danielsimonjr/mathts-core';

isComplex(new Complex(1, 2)); // true
isComplex(42); // false
```

## Differences from mathjs

- `Complex` is constructed with `new Complex(re, im)`, not `math.complex(re, im)`
- Instances are **immutable** — properties `re` and `im` are `readonly`
- No external `complex.js` dependency — implemented natively in TypeScript
- `valueOf()` returns the magnitude for numeric coercion contexts

## Related

- [Numbers](numbers.md)
- [BigNumber](bignumbers.md)
