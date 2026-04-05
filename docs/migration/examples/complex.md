# Complex Number Migration Example

Migrating complex number operations from mathjs to MathTS.

## Before (mathjs)

```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Create complex numbers
const z1 = math.complex(3, 4);
const z2 = math.complex('2 + 3i');
const z3 = math.complex({ re: 1, im: 2 });

// Arithmetic
const sum = math.add(z1, z2);
const product = math.multiply(z1, z2);
const quotient = math.divide(z1, z2);
const power = math.pow(z1, 2);

// Properties
const real = math.re(z1);
const imag = math.im(z1);
const magnitude = math.abs(z1);
const angle = math.arg(z1);
const conjugate = math.conj(z1);

// Complex functions
const expZ = math.exp(z1);
const logZ = math.log(z1);
const sinZ = math.sin(z1);
const sqrtZ = math.sqrt(z1);

// Using imaginary unit
const z4 = math.add(3, math.multiply(4, math.i));

// Type checking
const isComplex = math.isComplex(z1);
```

## After (MathTS with compat layer)

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);

// Create complex numbers - same API
const z1 = math.complex(3, 4);
const z2 = math.complex('2 + 3i');  // String parsing supported
const z3 = math.complex({ re: 1, im: 2 });

// Arithmetic - same API
const sum = math.add(z1, z2);
const product = math.multiply(z1, z2);
const quotient = math.divide(z1, z2);
const power = math.pow(z1, 2);

// Properties - same API
const real = math.re(z1);
const imag = math.im(z1);
const magnitude = math.abs(z1);
const angle = math.arg(z1);
const conjugate = math.conj(z1);

// Complex functions - same API
const expZ = math.exp(z1);
const logZ = math.log(z1);
const sinZ = math.sin(z1);
const sqrtZ = math.sqrt(z1);

// Using imaginary unit
const z4 = math.add(3, math.multiply(4, math.i));

// Type checking
const isComplex = math.isComplex(z1);
```

## After (Native MathTS API)

```typescript
import { Complex, I } from '@danielsimonjr/mathts-core';
import { add, multiply, divide, pow, exp, log, sin, sqrt } from '@danielsimonjr/mathts-functions';
import { isComplex } from '@danielsimonjr/mathts-core';

// Create complex numbers
const z1 = new Complex(3, 4);
const z2 = Complex.parse('2 + 3i');  // Static method for parsing
const z3 = new Complex(1, 2);

// Arithmetic using typed functions
const sum = add(z1, z2);
const product = multiply(z1, z2);
const quotient = divide(z1, z2);
const power = pow(z1, 2);

// Properties as object properties/methods
const real = z1.re;
const imag = z1.im;
const magnitude = z1.abs();
const angle = z1.arg();
const conjugate = z1.conjugate();

// Complex functions
const expZ = exp(z1);
const logZ = log(z1);
const sinZ = sin(z1);
const sqrtZ = sqrt(z1);

// Using imaginary unit
const z4 = new Complex(3, 0).add(I.multiply(new Complex(4, 0)));
// Or more simply:
const z4b = new Complex(3, 4);

// Type checking
const isComplexNum = isComplex(z1);

// Complex-specific operations
const polar = z1.toPolar();  // { r: 5, phi: 0.927... }
const z5 = Complex.fromPolar(5, Math.PI / 4);

// String representation
console.log(z1.toString());  // "3 + 4i"
```

## Key Differences

| mathjs | MathTS Compat | MathTS Native |
|--------|---------------|---------------|
| `math.complex(3, 4)` | `math.complex(3, 4)` | `new Complex(3, 4)` |
| `math.complex('2+3i')` | `math.complex('2+3i')` | `Complex.parse('2+3i')` |
| `math.re(z)` | `math.re(z)` | `z.re` |
| `math.im(z)` | `math.im(z)` | `z.im` |
| `math.abs(z)` | `math.abs(z)` | `z.abs()` |
| `math.arg(z)` | `math.arg(z)` | `z.arg()` |
| `math.conj(z)` | `math.conj(z)` | `z.conjugate()` |
| `math.i` | `math.i` | `I` |
| `math.isComplex(z)` | `math.isComplex(z)` | `isComplex(z)` |

## Fractions

Similar patterns apply to fractions:

### mathjs
```typescript
const f = math.fraction(1, 3);
const sum = math.add(f, math.fraction(1, 6));
```

### MathTS Native
```typescript
import { Fraction } from '@danielsimonjr/mathts-core';
import { add } from '@danielsimonjr/mathts-functions';

const f = new Fraction(1, 3);
const sum = add(f, new Fraction(1, 6));

// Fraction-specific
console.log(f.toString());  // "1/3"
console.log(f.valueOf());   // 0.333...
```

## BigNumber

### mathjs
```typescript
const bn = math.bignumber('0.1');
const sum = math.add(bn, math.bignumber('0.2'));
```

### MathTS Native
```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';
import { add } from '@danielsimonjr/mathts-functions';

const bn = BigNumber.parse('0.1');
const sum = add(bn, BigNumber.parse('0.2'));

console.log(sum.toString());  // "0.3" (exact!)
```

## Migration Steps

1. **Quick migration**: Change import, everything works
2. **Gradual adoption**: Replace property access (`math.re(z)` -> `z.re`)
3. **Full migration**: Use constructors directly for better type safety
