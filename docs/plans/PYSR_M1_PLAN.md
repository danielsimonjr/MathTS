# Plan: M1 — `ScalarNode` structural toolkit and canonical key

**Status:** ready to implement. This file is the contract. Do not widen it into M2–M15.
**Package:** `@danielsimonjr/mathts-expression` (`expression/`). **Size:** S. **Depends on:** nothing.
**Source of truth:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) §6 M1, §5 (cross-cutting rules).
**Bump:** minor (additive). Do not edit `expression/package.json` `"version"`.

A lighter model should implement this file as written. Where the roadmap sketch and this plan differ, this plan wins. The only intentional API addition is `scalarCanonical`, which the roadmap's parity test needs and the sketch did not name.

## Outcome

Pure functions over the existing `ScalarNode` type from `expression/src/scalar-builder.ts`: preorder walk, post-order immutable map, node count, depth, PySR-style weighted complexity, sorted symbol names, and a canonical structural key. No new node kinds. No evaluator, no `Node` bridge, no search.

`scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `forEachScalar`, and `mapScalar` walk the **stored** tree. They do not rewrite `-` or `/`. Only `scalarCanonical`, `scalarCanonicalKey`, and `scalarEquals` apply the rewrites below.

## Non-goals

- Do not import `@danielsimonjr/mathts-functions` or `functions/src/**` from `expression/`. The dependency edge runs the other way. The value-parity test lives in `tests/integration/`.
- Do not constant-fold `^` of two numbers (`2^3` stays a power; it does not become `8`).
- Do not combine like terms of `+` (`x+x` stays two addends; it does not become `2*x`).
- Do not delete a factor whose exponents sum to 0 (`x/x` becomes `x^0`, not `1`).
- Do not distribute `*` over `+`.
- Do not call `eval` or `new Function`. Do not read `node:` builtins.
- Do not mutate the input node, its `args` array, or any nested node.

## Files to add or change

| Path                                                | Action                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `expression/src/scalar-structure.ts`                | **Add.** Implementation and the exports below. File header uses `@packageDocumentation`, matching `scalar-builder.ts`. Import `ScalarBuildError`, `ScalarNode`, `ScalarOperator`, and `LoweredScalarFn` from `./scalar-builder.js`.                                                                                                                                |
| `expression/src/index.ts`                           | **Change.** Add the export block in [Exports](#exports) immediately after the existing scalar-builder export (after the `ScalarOperator` type export, around the current lines 44–57). Named exports, not `export *`.                                                                                                                                              |
| `expression/tests/scalar-structure.test.ts`         | **Add.** Unit tests. Import `{ describe, expect, it } from 'vitest'` and the functions from `../src/scalar-structure.js` plus `* as expression from '../src/index.js'`. Match `expression/tests/scalar-builder.test.ts`.                                                                                                                                           |
| `tests/integration/scalar-canonical-parity.test.ts` | **Add.** Value parity. Import from the package names `@danielsimonjr/mathts-expression` and `@danielsimonjr/mathts-functions` (those resolve to **dist**).                                                                                                                                                                                                         |
| `expression/README.md`                              | **Change.** Add one bullet under "What it provides", after the `createScalarBuilder` bullet: `` `scalarCanonical` / `scalarCanonicalKey` / `scalarSize` / `scalarDepth` / `scalarComplexity` / `scalarSymbols` — structural toolkit for an existing `ScalarNode`. The canonical key flattens `+` and `*`, rewrites `-` and `/`, and does not fold `2^3` to `8`. `` |
| `.changeset/scalar-structure-m1.md`                 | **Add.** Contents in [Changeset](#changeset).                                                                                                                                                                                                                                                                                                                      |
| `docs/Architecture/*`                               | **Generated.** Do not hand-edit. Staging `expression/src/**` makes the pre-commit hook run `bun run docs:deps` and stage the census. Commit that generated diff.                                                                                                                                                                                                   |

`expression` is not a target of `tools/generate-functions-reference.mjs`. Do not add these names to `DOMAIN_SUPPLEMENT`.

## Exports

Add this block to `expression/src/index.ts`:

```ts
export {
  forEachScalar,
  mapScalar,
  scalarSize,
  scalarDepth,
  scalarComplexity,
  scalarSymbols,
  scalarCanonical,
  scalarCanonicalKey,
  scalarEquals,
} from './scalar-structure.js';
export type { ScalarComplexityWeights } from './scalar-structure.js';
```

### Signatures and TSDoc

Paste this TSDoc onto the real declarations. Keep the names and the types exact.

```ts
/**
 * Per-node weights for {@link scalarComplexity}.
 *
 * Omitted fields default to 1, which is PySR's `complexity_of_operators`,
 * `complexity_of_constants`, and `complexity_of_variables` default.
 * A `symbol` record supplies per-name weights; a name that is absent from
 * the record still weighs 1. Weights are summed across the stored tree and
 * then rounded with `Math.round` (PySR rounds to the nearest integer after
 * the sum; the half-tie rule here is JavaScript's, not Julia's half-to-even).
 */
export interface ScalarComplexityWeights {
  /** Weight of one operator node. Default 1 for every {@link ScalarOperator}. */
  readonly op?: Partial<Record<ScalarOperator, number>>;
  /** Weight of one call node, keyed by the lowered name (`ln` is `log`). Default 1. */
  readonly call?: Partial<Record<LoweredScalarFn, number>>;
  /** Weight of one number node. Default 1. PySR `complexity_of_constants`. */
  readonly number?: number;
  /** Weight of one symbol node: one number for every name, or a per-name record. Default 1. */
  readonly symbol?: number | Readonly<Record<string, number>>;
}

/**
 * Preorder walk. The root is visited first, at `depth` 0, then each child
 * left to right. `depth` here is not {@link scalarDepth}: a leaf visited by
 * this function has depth 0 when it is the root, while `scalarDepth` of any
 * leaf is 1.
 */
export function forEachScalar(
  node: ScalarNode,
  visit: (n: ScalarNode, depth: number) => void
): void;

/**
 * Post-order immutable map. Children are mapped first. `fn` then receives
 * the node with those children and its return value replaces the node.
 * The replacement is not walked again.
 *
 * When a child result is the same reference and `fn` returns the rebuilt
 * node, the original node reference is kept. The input tree is never mutated,
 * including a deep-frozen input.
 */
export function mapScalar(node: ScalarNode, fn: (n: ScalarNode) => ScalarNode): ScalarNode;

/** Number of nodes in the stored tree. An empty `+` is one node. */
export function scalarSize(node: ScalarNode): number;

/**
 * Stored-tree depth. A number or symbol is 1. A call is `1 + scalarDepth(arg)`.
 * An operator is `1 + max(child depths)`, or 1 when it has no children.
 */
export function scalarDepth(node: ScalarNode): number;

/**
 * Weighted node count of the stored tree. See {@link ScalarComplexityWeights}.
 * The return value is `Math.round` of the sum, so default weights make this
 * equal `scalarSize`. Walks `-` and `/` as stored; it does not rewrite them first.
 */
export function scalarComplexity(node: ScalarNode, weights?: ScalarComplexityWeights): number;

/**
 * Sorted unique `symbol` names in the stored tree. Function names and number
 * literals are not included. Sort is UTF-16 code-unit order (`<` on strings).
 */
export function scalarSymbols(node: ScalarNode): readonly string[];

/**
 * Canonical tree. Idempotent: `scalarCanonical(scalarCanonical(n))` is deeply
 * equal to `scalarCanonical(n)`. Does not mutate `n`. The result uses only
 * `number`, `symbol`, `call`, `+`, `*`, and `^`. See the algorithm below.
 */
export function scalarCanonical(node: ScalarNode): ScalarNode;

/**
 * `JSON.stringify` of {@link scalarCanonical}, with the key order fixed in
 * "Key encoding". Equal keys are the definition of structural equality.
 */
export function scalarCanonicalKey(node: ScalarNode): string;

/** `scalarCanonicalKey(a) === scalarCanonicalKey(b)`. */
export function scalarEquals(a: ScalarNode, b: ScalarNode): boolean;
```

`^` with an argument count other than 2 throws the existing `ScalarBuildError`. Message: `` `'^' needs exactly 2 args, got ${n}` `` (same wording as `createScalarBuilder`). A `call` whose `fn` is not a `LoweredScalarFn` throws `ScalarBuildError` with `` `unknown scalar function '${String(fn)}'` ``. No other new error class.

## Key encoding

Build the canonical tree first, then `JSON.stringify` it. Objects are created with keys in the order below so the string is stable. No whitespace.

| Node                    | Object inserted in this key order                  |
| ----------------------- | -------------------------------------------------- |
| number                  | `{ k: 'n', v: spell(value) }`                      |
| symbol                  | `{ k: 's', v: name }`                              |
| `+` with 2 or more args | `{ k: '+', a: [key of each arg, already sorted] }` |
| `*` with 2 or more args | `{ k: '*', a: [key of each arg, already sorted] }` |
| `^`                     | `{ k: '^', b: base, e: exponent }`                 |
| call                    | `{ k: 'c', f: loweredFn, a: arg }`                 |

`spell(value)`:

| Value              | Spelling                                         |
| ------------------ | ------------------------------------------------ |
| any NaN            | `"NaN"` (one spelling for every NaN bit pattern) |
| `-0`               | `"-0"`                                           |
| `+Infinity`        | `"Infinity"`                                     |
| `-Infinity`        | `"-Infinity"`                                    |
| every other number | `value.toString()`                               |

`Object.is(Number(spell(n)), n)` holds for every finite number except NaN, and `-0` is handled before `toString` (because `(-0).toString()` is `"0"`). Symbol names and spellings are JSON strings, so quotes and control characters are escaped by `JSON.stringify`.

Operand sort for `+` and `*` is ascending lexicographic order of that operand's key string (`a < b` on the strings). Do not use `localeCompare`.

## Canonical algorithm

`canon(node)` returns a new tree and never writes into `node`. Children are canonicalized before the parent is rewritten. A `+` or `*` result with fewer than 2 operands is collapsed to that operand, or to the identity number when there are zero (`+` and `-` identity `0`, `*` and `/` identity `1`).

### Factor list

While a product is being built, a factor is `{ base: ScalarNode, exp: number }` with a **finite** `exp`.

- A node that is not a product and not a finite-exponent power is `{ base: node, exp: 1 }`.
- A `*` contributes the factor lists of its operands, concatenated in stored left-to-right order.
- A `^` whose exponent is a finite number contributes the base's factors with each `exp` multiplied by that number (JavaScript `*`). This is what makes `(b/c)^-1` and `(x^2)^3` combine. A non-finite numeric exponent (`NaN`, `±Infinity`) does **not** distribute: the power stays one opaque factor `{ base: the power node, exp: 1 }`.
- A `^` whose exponent is not a number stays opaque the same way.

### `fromProduct(factors)`

1. Flatten with the rules above until every base is neither a `*` nor a finite-exponent `^`.
2. Split the list, preserving encounter order:
   - **coefficients:** `base.kind === 'number'` and `Object.is(exp, 1)`.
   - **rest:** everything else, including `2^-1` and `2^3` (the exponent is not `1`, so they are not folded into the coefficient).
3. If there is at least one coefficient, set `coeff` to the JavaScript product of those number values in encounter order. `(-1) * 0` is `-0`; keep it.
4. Group `rest` by `key(base)`. Sum exponents inside a group with JavaScript `+`, in encounter order.
5. Materialize each group:
   - summed exponent `Object.is(sum, 1)` → the base itself.
   - otherwise → `{ kind: 'op', op: '^', args: [base, { kind: 'number', value: sum }] }`, **including when the sum is 0**. Do not replace `base^0` with `1`.
6. Include the coefficient number as an extra materialized factor, except when `Object.is(coeff, 1)` and at least one other factor exists (`1*x` becomes `x`, and this is bit-exact for every IEEE value). A coefficient of `0` or `-0` is kept. If the only factor would be the coefficient, the result is that number. If there were no coefficient factors and no other factors, the result is `{ kind: 'number', value: 1 }`.
7. One remaining factor is returned as itself. Two or more are sorted by key and returned as `{ kind: 'op', op: '*', args }`.

### `fromSum(parts)`

1. Inline nested `+` nodes, left to right.
2. Sum every **direct number** part with JavaScript `+` in that encounter order, into one number. Non-number parts are not combined, even when their keys match (`x+x` stays two `x` addends).
3. Keep that numeric sum as an addend even when it is `0` or `-0`, whenever any non-number part exists. `x+0` and `x` do **not** share a key.
4. If every part was a number, return that one number (not a `+`). Zero parts return `{ kind: 'number', value: 0 }`.
5. One addend is returned as itself. Two or more are sorted by key and returned as `{ kind: 'op', op: '+', args }`.

### Per-kind rules

| Stored node              | Canonical result                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| number, symbol           | the same node (same reference allowed)                                                                                                                                                                                                                                |
| `call`                   | `{ kind: 'call', fn, arg: canon(arg) }`. `fn` is already the lowered name, so `ln` (`log`) and `log` (`log10`) stay distinct                                                                                                                                          |
| `+` with 0 args          | number `0`                                                                                                                                                                                                                                                            |
| `+` with 1 arg           | `canon` of that arg                                                                                                                                                                                                                                                   |
| `+` with n≥2             | `fromSum` of `canon` of each arg                                                                                                                                                                                                                                      |
| `-` with 0 args          | number `0`                                                                                                                                                                                                                                                            |
| `-` with 1 arg           | `canon` of that arg. A one-argument `-` does **not** negate; that matches `evaluateScalar`                                                                                                                                                                            |
| `-` with n≥2             | `canon(head) + (-1)*canon(a1) + (-1)*canon(a2) + …` passed through `fromSum`. Each `(-1)*term` is a product of a number `-1` and that term, then `fromProduct`. This is the left fold `((head - a1) - a2) - …`. Do not distribute the `-1` across a sum inside `term` |
| `*` with 0 args          | number `1`                                                                                                                                                                                                                                                            |
| `*` with 1 arg           | `canon` of that arg                                                                                                                                                                                                                                                   |
| `*` with n≥2             | `fromProduct` of the factors of `canon` of each arg                                                                                                                                                                                                                   |
| `/` with 0 args          | number `1`                                                                                                                                                                                                                                                            |
| `/` with 1 arg           | `canon` of that arg                                                                                                                                                                                                                                                   |
| `/` with n≥2             | `canon` of the product `head * a1^-1 * a2^-1 * …`, where `t^-1` is `{ kind: 'op', op: '^', args: [t, { kind: 'number', value: -1 }] }`. The power rule then distributes that `-1` over a product, which is why `a/(b/c)`, `a*c/b`, and `(c*a)*b^-1` meet              |
| `^` with 2 args          | `fromProduct(applyNumericPower(factors(canon(base)), exp.value))` when `canon(exp)` is a finite number; otherwise a `^` node of the two canonical children, not reordered                                                                                             |
| `^` with any other arity | throw `ScalarBuildError` as specified above                                                                                                                                                                                                                           |

`a/(b/c)` walk-through, which the tests lock:

- `b/c` → factors `{b, 1}` and `{c, -1}` → product sorted as `c^-1`, then `b`.
- `a / that` → `a * (that)^-1` → factors `{a, 1}`, `{c, 1}`, `{b, -1}`.
- Sorted product: `b^-1`, `a`, `c`.

## Tests

### `expression/tests/scalar-structure.test.ts`

Build trees with `createScalarBuilder()` from `../src/scalar-builder.js`. Assert keys with `toBe` against the strings in the tables. Assert `scalarEquals` both ways on every equivalence class.

**Export surface.** `expression.scalarCanonicalKey === scalarCanonicalKey` (and the same for the other eight functions). `expression.SCALAR_FUNCTION_LOWERING` is unchanged (`ln` → `log`, `log` → `log10`).

**Walk of `+(x, *(y, 2))`.** `forEachScalar` visits, in order, with depths: the `+` at 0, symbol `x` at 1, the `*` at 1, symbol `y` at 2, number `2` at 2. `scalarSize` is `5`. `scalarDepth` is `3`. `scalarSymbols` is `['x', 'y']`.

**Other size and depth values.**

| Tree                          | `scalarSize` | `scalarDepth` |
| ----------------------------- | ------------ | ------------- |
| symbol `x`                    | 1            | 1             |
| `x^2`                         | 3            | 2             |
| `+()`                         | 1            | 1             |
| `sin(x)` via `call('sin', x)` | 2            | 2             |
| `+(call('sin', x), number 2)` | 4            | 3             |

**`mapScalar`.** On `+(x, y)`, replace a symbol named `x` with a symbol named `z`. The result is `+(z, y)` and is **not** run through `canon`. The original `+` still has symbol `x` (deep-freeze the input before mapping; the call must not throw). Mapping with `(n) => n` returns the same root reference.

**Symbols.** `scalarSymbols` of `call('ln', +(symbol('b'), symbol('a'), symbol('a')))` is `['a', 'b']`. An empty name is kept. A tree of only numbers is `[]`.

**Complexity, stored tree, `Math.round`.**

| Tree                          | Weights                                                             | Expected                         |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| `+(call('sin', x), number 2)` | omitted                                                             | `4` (equals `scalarSize`)        |
| same                          | `{ op: { '+': 1 }, call: { sin: 3 }, number: 1, symbol: { x: 2 } }` | `7` (`1+3+2+1`)                  |
| `*(x, y)`                     | `{ op: { '*': 0.2 }, symbol: 1 }`                                   | `2` (`Math.round(2.2)`)          |
| number `0`                    | `{ number: 2.5 }`                                                   | `3` (`Math.round(2.5) === 3`)    |
| number `0`                    | `{ number: -1.5 }`                                                  | `-1` (`Math.round(-1.5) === -1`) |
| `-(x, y)`                     | `{ op: { '-': 5 }, symbol: 1 }`                                     | `7`                              |

The last row is the lock that complexity does not rewrite `-` into `+` and `*` first. A missing name in a symbol record weighs 1: `-(x, y)` with `{ symbol: { x: 4 } }` is `1 + 4 + 1 = 6` (the `-` node defaults to 1, `y` defaults to 1).

**Equivalence classes.** Every tree in a row has the key in that row, and `scalarEquals` is true across the row.

| Class                                                  | Key                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `x^2`, `*(x, x)`, `*(x, *(x))`                         | `{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"2"}}`                                                      |
| `a/(b/c)`, `/( *(a, c), b )`, `*( *(c, a), ^(b, -1) )` | `{"k":"*","a":[{"k":"^","b":{"k":"s","v":"b"},"e":{"k":"n","v":"-1"}},{"k":"s","v":"a"},{"k":"s","v":"c"}]}` |
| `+(x, y)` and `+(y, x)`                                | `{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"y"}]}`                                                        |
| `*(a, *(b, c))` and `*(c, b, a)`                       | `{"k":"*","a":[{"k":"s","v":"a"},{"k":"s","v":"b"},{"k":"s","v":"c"}]}`                                      |
| `+(number 1, number 2, x)` and `+(x, number 3)`        | `{"k":"+","a":[{"k":"n","v":"3"},{"k":"s","v":"x"}]}`                                                        |
| `*(number 2, number 3, x)` and `*(x, number 6)`        | `{"k":"*","a":[{"k":"n","v":"6"},{"k":"s","v":"x"}]}`                                                        |
| `*(number 1, x)` and symbol `x`                        | `{"k":"s","v":"x"}`                                                                                          |
| `(x^2)^3` and `x^6`                                    | `{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"6"}}`                                                      |
| `call('ln', x)`                                        | `{"k":"c","f":"log","a":{"k":"s","v":"x"}}`                                                                  |
| `call('log', x)` and `call('log10', x)`                | `{"k":"c","f":"log10","a":{"k":"s","v":"x"}}`                                                                |
| `+()` and `-()`                                        | `{"k":"n","v":"0"}`                                                                                          |
| `*()` and `/()`                                        | `{"k":"n","v":"1"}`                                                                                          |
| one-arg `-(x)`                                         | `{"k":"s","v":"x"}`                                                                                          |

**Non-equivalences.** `scalarEquals` is false, and the keys are the strings shown.

| Tree                    | Key                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `-(x, y)`               | `{"k":"+","a":[{"k":"*","a":[{"k":"n","v":"-1"},{"k":"s","v":"y"}]},{"k":"s","v":"x"}]}` |
| `-(y, x)`               | `{"k":"+","a":[{"k":"*","a":[{"k":"n","v":"-1"},{"k":"s","v":"x"}]},{"k":"s","v":"y"}]}` |
| `+(x, x)`               | `{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"x"}]}`                                    |
| `*(number 2, x)`        | `{"k":"*","a":[{"k":"n","v":"2"},{"k":"s","v":"x"}]}`                                    |
| `^(number 2, number 3)` | `{"k":"^","b":{"k":"n","v":"2"},"e":{"k":"n","v":"3"}}`                                  |
| number `8`              | `{"k":"n","v":"8"}`                                                                      |
| `/(x, x)`               | `{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"0"}}`                                  |
| number `1`              | `{"k":"n","v":"1"}`                                                                      |
| `*(number 0, x)`        | `{"k":"*","a":[{"k":"n","v":"0"},{"k":"s","v":"x"}]}`                                    |
| number `0`              | `{"k":"n","v":"0"}`                                                                      |
| number `-0`             | `{"k":"n","v":"-0"}`                                                                     |
| `NaN`                   | `{"k":"n","v":"NaN"}`                                                                    |
| `Infinity`              | `{"k":"n","v":"Infinity"}`                                                               |
| `-Infinity`             | `{"k":"n","v":"-Infinity"}`                                                              |
| symbol `a"b`            | `{"k":"s","v":"a\"b"}`                                                                   |

`-(x, y)` and `-(y, x)` differ. `+(x, x)` and `*(number 2, x)` differ. `2^3` and `8` differ. `x/x` and `1` differ. `0*x` and `0` differ. `-0` and `0` differ. Natural `log` and `log10` differ.

**Idempotence.** For every tree in the two tables, `scalarCanonical(scalarCanonical(t))` deep-equals `scalarCanonical(t)` (`toEqual`), and the key of the canonical tree equals the key of `t`.

**Purity.** `structuredClone` a tree, `Object.freeze` it recursively, then call every function above (use `(n) => n` for `mapScalar`). The frozen tree still deep-equals the clone. No test calls a function that sorts `args` in place.

**Bad power.** `scalarCanonical` of a hand-built `{ kind: 'op', op: '^', args: [number 2] }` throws `ScalarBuildError` matching `/exactly 2 args/`. Do not build that node with the builder; the builder already rejects it. The cast sits at this one site with a one-line comment.

**Seeded permutation property.** Use this generator, not `Math.random` and not M5's RNG (M5 is not shipped).

```ts
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

A fresh `mulberry32(0xc0ffee)` yields these first four values (`toBe`): `0.021141508361324668`, `0.6661099966149777`, `0.7799714196007699`, `0.7395844468846917`.

A second fresh `mulberry32(0xc0ffee)` builds 200 trees. `gen(rng, depth)`: if `depth === 0` or `rng() < 0.4`, return a leaf: with probability 1/2 a symbol from `['a', 'b', 'c']` chosen by `Math.floor(rng() * 3)`, otherwise `number(1 + Math.floor(rng() * 5))` (integers 1 through 5). Otherwise an operator `+` or `*` chosen by `rng() < 0.5`, with 2 children when `rng() < 0.5` and 3 otherwise, each `gen(rng, depth - 1)`. Start each tree at depth 4.

For each tree, build a copy that recursively reverses the `args` of every `+` and `*`. `scalarCanonicalKey` of the copy equals the key of the original. Assert the loop ran 200 times. Do not snapshot the 200 keys.

### `tests/integration/scalar-canonical-parity.test.ts`

Header comment: canonicalization is an algebraic rewrite. It is bit-exact on the fixtures below (safe integers). It is not a claim about every non-associative IEEE expression. The oracle is `evaluateScalar` of the original and of `scalarCanonical(original)`, compared with `Object.is`.

Build expression first (`bunx turbo build --filter=@danielsimonjr/mathts-expression --filter=@danielsimonjr/mathts-functions`) before this file. `bunx vitest run tests/integration/scalar-canonical-parity.test.ts` reads **dist**. Package unit tests read `../src` and do not need that build.

| Expression                 | Scope                  | Value |
| -------------------------- | ---------------------- | ----- |
| `a/(b/c)`                  | `{ a: 6, b: 2, c: 3 }` | `9`   |
| `*(a, c) / b`              | same                   | `9`   |
| `*( *(c, a), ^(b, -1) )`   | same                   | `9`   |
| `*(x, x)`                  | `{ x: 7 }`             | `49`  |
| `x^2`                      | `{ x: 7 }`             | `49`  |
| `(x^2)^3`                  | `{ x: 2 }`             | `64`  |
| `x^6`                      | `{ x: 2 }`             | `64`  |
| `-(x, y)`                  | `{ x: 5, y: 2 }`       | `3`   |
| `+(number 1, x, number 2)` | `{ x: 4 }`             | `7`   |

For each row, `Object.is(evaluateScalar(tree, scope), value)` and `Object.is(evaluateScalar(scalarCanonical(tree), scope), value)`. The three quotient rows share one `scalarCanonicalKey`, and so do each of the pairs `x*x` / `x^2` and `(x^2)^3` / `x^6`.

## Changeset

File `.changeset/scalar-structure-m1.md`:

```md
---
'@danielsimonjr/mathts-expression': minor
---

Add a ScalarNode structural toolkit: traversal, size, depth, weighted complexity, symbol collection, and a canonical structural key.
```

One changeset. Do not bump `functions`. Do not add a changelog entry by hand; changesets does that at release.

## Acceptance criteria

- [ ] The nine functions and `ScalarComplexityWeights` are exported from `@danielsimonjr/mathts-expression` and from `expression/src/index.ts`.
- [ ] Keys match the tables, including `-0`, one `NaN` spelling, and the three-way quotient identity.
- [ ] `x-y` and `y-x` differ; natural `log` and `log10` differ; `x*x` and `x^2` agree; `2^3` and `8` disagree; `x/x` and `1` disagree.
- [ ] Default `scalarComplexity` equals `scalarSize`. The weighted `sin` example is 7. `Math.round(2.5) === 3` and `Math.round(-1.5) === -1` are the half-tie rules.
- [ ] Complexity of `-(x, y)` with `op['-'] = 5` is 7 (stored tree, not the rewrite).
- [ ] Deep-frozen inputs survive every function.
- [ ] The 200-tree reverse-child property passes on seed `0xC0FFEE`, and the four pinned generator outputs match.
- [ ] The integration fixtures agree with `evaluateScalar` under `Object.is`, original and canonical.
- [ ] `bunx turbo typecheck --filter=@danielsimonjr/mathts-expression` reports 0 errors.
- [ ] `bunx turbo test --filter=@danielsimonjr/mathts-expression` passes.
- [ ] After the expression and functions builds, `bunx vitest run tests/integration/scalar-canonical-parity.test.ts` passes.
- [ ] `bun run lint` is clean for the new file (oxlint, warnings denied).
- [ ] No `node:` import. `bun run check:browser-safety` passes.
- [ ] `bun run check:duplicates:fast` reports no new `TRUE_DUPLICATE`.
- [ ] The pre-commit census update is committed with the source. `bun run check:file-census` passes.
- [ ] The changeset above is the only changeset in the PR.

## Verification commands

```bash
bunx turbo typecheck --filter=@danielsimonjr/mathts-expression
bunx turbo test --filter=@danielsimonjr/mathts-expression
bunx turbo build --filter=@danielsimonjr/mathts-expression --filter=@danielsimonjr/mathts-functions
bunx vitest run tests/integration/scalar-canonical-parity.test.ts
```

`bun run typecheck` and `bun run lint` remain the repo-wide bars if those filters are green and time allows. Do not claim a speedup. No benchmark in this PR.

## Locked decisions

These are settled for the implementer. They are listed so a review can overturn them before code lands; they are not implementation choices.

1. **`scalarCanonical` is public.** The roadmap sketch omitted it. The parity test and any later dedup need the tree, not only the string.
2. **Numeric exponent distribution is on**, so `(x^2)^3` and `x^6` share a key, and so do `a/(b/c)` and `a*c/b`. Multiplication is not distributed over addition.
3. **`base^0` is kept.** `x/x` is not `1`. **`2^3` is not `8`.** **`x+x` is not `2*x`.** **`x+0` is not `x`.**
4. **Complexity rounds with `Math.round`.** A half-integer weight uses JavaScript (half toward +∞), not Julia's half-to-even. The tests pin 2.5 → 3 and -1.5 → -1.
5. **Traversal depth and `scalarDepth` are different numbers.** The visit depth of the root is 0. `scalarDepth` of a leaf is 1.
