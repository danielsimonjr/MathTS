# Serialization

MathTS numeric types implement `toJSON()` / `fromJSON()` for lossless JSON serialization. Use cases include persisting data to disk, exchanging data between a server and browser, and passing values between a main thread and a web worker.

## Overview

Every MathTS type serializes to a plain object with a `mathjs` discriminant field. This allows a single reviver function to reconstruct the correct type.

| Type | Serialized shape |
|---|---|
| `Complex` | `{ mathjs: "Complex", re: number, im: number }` |
| `Fraction` | `{ mathjs: "Fraction", n: string, d: string }` |
| `BigNumber` | `{ mathjs: "BigNumber", value: string }` |
| `DenseMatrix` | `{ mathjs: "DenseMatrix", data: any[], size: number[], datatype?: string }` |

## Serializing with `JSON.stringify`

```typescript
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

const c = new Complex(2, 3);
JSON.stringify(c);
// '{"mathjs":"Complex","re":2,"im":3}'

const f = new Fraction(1n, 3n);
JSON.stringify(f);
// '{"mathjs":"Fraction","n":"1","d":"3"}'

const b = new BigNumber('3.14159265358979323846');
JSON.stringify(b);
// '{"mathjs":"BigNumber","value":"3.14159265358979323846"}'
```

## Deserializing with `fromJSON`

```typescript
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

const c = Complex.fromJSON({ re: 2, im: 3 });          // Complex(2, 3)
const f = Fraction.fromJSON({ n: '1', d: '3' });       // Fraction(1/3)
const b = BigNumber.fromJSON({ value: '3.14159' });    // BigNumber('3.14159')
```

## Round-Trip Example

```typescript
import { Complex } from '@danielsimonjr/mathts-core';

const original = new Complex(2, -5);
const json = JSON.stringify(original);
const parsed = JSON.parse(json);

// Reconstruct from the parsed object
const restored = Complex.fromJSON(parsed);

console.log(restored.toString());   // '2 - 5i'
console.log(restored.re === 2);     // true
console.log(restored.im === -5);    // true
```

## Writing a Universal Reviver

When mixing types in a single JSON payload, write a reviver that dispatches on the `mathjs` field:

```typescript
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const revivers: Record<string, (json: any) => unknown> = {
  Complex:     Complex.fromJSON.bind(Complex),
  Fraction:    Fraction.fromJSON.bind(Fraction),
  BigNumber:   BigNumber.fromJSON.bind(BigNumber),
  DenseMatrix: DenseMatrix.fromJSON.bind(DenseMatrix),
};

function mathtsReviver(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'mathjs' in value) {
    const tag = (value as any).mathjs as string;
    if (tag in revivers) return revivers[tag](value);
  }
  return value;
}

// Use it with JSON.parse
const payload = `{
  "x": {"mathjs":"Complex","re":1,"im":2},
  "q": {"mathjs":"Fraction","n":"3","d":"4"}
}`;

const result = JSON.parse(payload, mathtsReviver);
console.log(result.x instanceof Complex);   // true
console.log(result.q instanceof Fraction);  // true
```

## Handling Special Numbers

JavaScript's `JSON.stringify` serializes `Infinity` and `NaN` as `null`. Wrap them when precision matters:

```typescript
// Wrapping Infinity manually
const payload = { value: Infinity };
const safe = JSON.stringify({ value: payload.value === Infinity ? 'Infinity' : payload.value });

// Or use a replacer
function mathtsReplacer(_key: string, value: unknown): unknown {
  if (value === Infinity) return { mathjs: 'Infinity' };
  if (value === -Infinity) return { mathjs: '-Infinity' };
  if (typeof value === 'number' && isNaN(value)) return { mathjs: 'NaN' };
  return value;
}

JSON.stringify({ x: Infinity }, mathtsReplacer);
// '{"x":{"mathjs":"Infinity"}}'
```

## DenseMatrix Serialization

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const m = new DenseMatrix([[1, 2], [3, 4]]);
const json = JSON.stringify(m.toJSON());
// '{"mathjs":"DenseMatrix","data":[[1,2],[3,4]],"size":[2,2]}'

const restored = DenseMatrix.fromJSON(JSON.parse(json));
console.log(restored.size());   // [2, 2]
```

## Fraction Compatibility

`Fraction.fromJSON` accepts both short-form (`n`, `d`) and long-form (`numerator`, `denominator`) keys:

```typescript
Fraction.fromJSON({ n: '1', d: '3' });                          // Fraction(1/3)
Fraction.fromJSON({ numerator: '1', denominator: '3' });        // Fraction(1/3)
```
