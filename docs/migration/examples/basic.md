# Basic Migration Example

Migrating basic arithmetic and type operations from mathjs to MathTS.

## Before (mathjs)

```typescript
import { create, all } from 'mathjs';

const math = create(all);

// Basic arithmetic
const sum = math.add(1, 2);
const product = math.multiply(3, 4);
const power = math.pow(2, 8);
const root = math.sqrt(16);

// Trigonometry
const sinVal = math.sin(math.pi / 2);
const cosVal = math.cos(0);

// Rounding
const rounded = math.round(2.567, 2);
const floored = math.floor(2.9);
const ceiled = math.ceil(2.1);

// Number theory
const gcdVal = math.gcd(12, 18);
const lcmVal = math.lcm(4, 6);

// Constants
console.log(math.pi);
console.log(math.e);
console.log(math.i);
```

## After (MathTS with compat layer)

```typescript
// Step 1: Just change the import!
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);

// All your existing code works unchanged:
const sum = math.add(1, 2);
const product = math.multiply(3, 4);
const power = math.pow(2, 8);
const root = math.sqrt(16);

const sinVal = math.sin(math.pi / 2);
const cosVal = math.cos(0);

const rounded = math.round(2.567, 2);
const floored = math.floor(2.9);
const ceiled = math.ceil(2.1);

const gcdVal = math.gcd(12, 18);
const lcmVal = math.lcm(4, 6);

console.log(math.pi);
console.log(math.e);
console.log(math.i);
```

## After (Native MathTS API)

For better performance and tree-shaking, use the native API:

```typescript
import { add, multiply, pow, sqrt, sin, cos } from '@danielsimonjr/mathts-functions';
import { gcd, lcm, round, floor, ceil } from '@danielsimonjr/mathts-functions';
import { I } from '@danielsimonjr/mathts-core';

// Direct function calls (better tree-shaking)
const sum = add(1, 2);
const product = multiply(3, 4);
const power = pow(2, 8);
const root = sqrt(16);

const sinVal = sin(Math.PI / 2);
const cosVal = cos(0);

const rounded = round(2.567, 2);
const floored = floor(2.9);
const ceiled = ceil(2.1);

const gcdVal = gcd(12, 18);
const lcmVal = lcm(4, 6);

console.log(Math.PI);
console.log(Math.E);
console.log(I); // imaginary unit (from mathts-core)
```

## Key Differences

| mathjs           | MathTS Compat    | MathTS Native          |
| ---------------- | ---------------- | ---------------------- |
| `math.add(a, b)` | `math.add(a, b)` | `add(a, b)`            |
| `math.pi`        | `math.pi`        | `Math.PI`              |
| `math.e`         | `math.e`         | `Math.E`               |
| `math.i`         | `math.i`         | `I` (from mathts-core) |

## Migration Steps

1. **Quick migration**: Change import from `mathjs` to `@danielsimonjr/mathts-compat`
2. **Gradual adoption**: Replace `math.fn()` calls with direct imports
3. **Full migration**: Use native MathTS API for best performance
