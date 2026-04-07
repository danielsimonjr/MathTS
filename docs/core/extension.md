# Extension

MathTS is extended by registering custom types and functions with the typed-function system. There is no `math.import()` — you work directly with `mathTyped` and `TypeRegistry`.

## Adding a Typed Function

Use `mathTyped` to create a polymorphic function that dispatches on argument types:

```typescript
import { mathTyped, Complex, Fraction } from '@danielsimonjr/mathts-core';

// Create a typed function with signatures for each type
export const clamp = mathTyped('clamp', {
  'number, number, number': (x: number, lo: number, hi: number): number =>
    Math.min(Math.max(x, lo), hi),

  'Complex, number, number': (x: Complex, lo: number, hi: number): Complex => {
    const mag = Math.min(Math.max(x.abs(), lo), hi);
    return Complex.fromPolar(mag, x.arg());
  },
});

// Use it with any registered type
clamp(5, 0, 10);                       // 5
clamp(15, 0, 10);                      // 10
clamp(new Complex(3, 4), 0, 4);        // Complex at magnitude 4
```

## Registering a Custom Type

Use `TypeRegistry` to introduce a new numeric type into the dispatch system:

```typescript
import { TypeRegistry, mathTyped } from '@danielsimonjr/mathts-core';

// Define a custom Quaternion type
class Quaternion {
  constructor(public w: number, public x: number,
              public y: number, public z: number) {}
  add(other: Quaternion): Quaternion {
    return new Quaternion(
      this.w + other.w, this.x + other.x,
      this.y + other.y, this.z + other.z
    );
  }
}

// Register the type
const registry = new TypeRegistry();
registry.registerType<Quaternion>('Quaternion', (v): v is Quaternion => v instanceof Quaternion);

// Register a conversion from number → Quaternion
registry.registerConversion<number, Quaternion>(
  'number', 'Quaternion',
  (n) => new Quaternion(n, 0, 0, 0)
);

// Create a typed instance with the new type
const myTyped = registry.createInstance();

// Define functions for the new type
export const addQ = myTyped('addQ', {
  'Quaternion, Quaternion': (a: Quaternion, b: Quaternion) => a.add(b),
});
```

## Extending an Existing Function

Add new signatures to an existing typed function by wrapping it:

```typescript
import { mathTyped, add } from '@danielsimonjr/mathts-functions';
import type { Quaternion } from './quaternion.js';

// Extend add() with Quaternion support
export const addExtended = mathTyped('add', {
  ...add,   // carry over existing signatures
  'Quaternion, Quaternion': (a: Quaternion, b: Quaternion) => a.add(b),
});
```

## Using `createMathTSTyped`

For isolated instances (e.g. in tests or sandboxed environments), create a fresh typed-function instance with all built-in MathTS types pre-registered:

```typescript
import { createMathTSTyped } from '@danielsimonjr/mathts-core';

const isolated = createMathTSTyped();

const double = isolated('double', {
  'number': (x: number) => x * 2,
});

double(5);   // 10
```

## Parallel Extension

For array types, follow the parallel-first pattern — return a Promise when accepting `Float64Array`:

```typescript
import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

export const reciprocal = mathTyped('reciprocal', {
  'number': (x: number) => 1 / x,

  'Float64Array': async (a: Float64Array): Promise<Float64Array> => {
    // Parallel element-wise 1/x via worker pool
    const result = await computePool.map(a, (x) => 1 / x);
    return result.result;
  },
});
```

## TypeRegistry API

| Method | Description |
|---|---|
| `registerType(name, testFn)` | Register a new type with its type-test predicate |
| `registerConversion(from, to, convertFn)` | Register an automatic type coercion |
| `createInstance()` | Return a new typed-function instance with all registered types |

## Key Rules

- Function names must be unique strings — they identify the dispatch table entry.
- Type names are case-sensitive and must match exactly between `registerType` and function signatures.
- Conversions are applied automatically when no exact signature matches.
- `mathTyped` is the shared global instance. Use `createMathTSTyped()` for isolated copies.
