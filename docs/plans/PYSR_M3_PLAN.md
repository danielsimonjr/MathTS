# Plan: M3 — batch compiled `ScalarNode` evaluator

**Status:** ready to implement. This file is the contract. Do not add gradients (M6), fitting (M7), or a WASM/GPU path.
**Package:** `@danielsimonjr/mathts-functions` (`functions/`). **Size:** M. **Depends on:** nothing. `ScalarNode` already ships from `expression`. Do not import `scalarCanonical` or `scalarSymbols`; M1 may be unmerged.
**Source of truth:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) §6 M3. Behavior of one row is `functions/src/scalar-eval.ts` (`evaluateScalar`, `requireFinite`, the numeric-literal regex).
**Bump:** minor (additive). Do not edit `functions/package.json` `"version"`.

The observable contract is bit-for-bit agreement with `evaluateScalar` on rows where that function returns, and `valid === 0` with a NaN value on rows where it throws. A shared bug is avoided by the hand-computed edge table, which does not call `compileScalar` to obtain the expected value.

## Outcome

`compileScalar` compiles one `ScalarNode` into a reusable evaluator over `Float64Array` columns. `evaluate` writes every row and never throws for a non-finite operator result. `evaluateRow` throws `ScalarEvalError` on those rows, as `evaluateScalar` does.

## Non-goals

- Do not call `eval` or `new Function`. Compile a register tape (below), not a string of JavaScript.
- Do not call the typed-function wrappers (`add`, `pow`, `log`, …). Their **number** signatures are the JavaScript operations listed below, and the tape calls those operations directly. Typed dispatch can return `Complex` or a `Promise` for other types; this evaluator is the number path only.
- Do not accept a formula string, a `transcendental` node, or an `abs` node. `evaluateScalar` normalizes those through `scalar.from`. `compileScalar` takes a `ScalarNode` only. Callers with the other shapes call `scalar.from` first. Document that in the TSDoc.
- Do not allocate the value buffer when the caller passes an `out` of the right length. Allocating the `Uint8Array` validity mask each call is allowed.
- Do not add a benchmark in this PR. The roadmap allows one under `tools/benchmark/` before any speed claim; leave it out until someone measures. No numbers in docs.
- No `node:` imports. No worker posting. M14 is separate.

## Files to add or change

| Path                                     | Action                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `functions/src/scalar-compile.ts`        | **Add.** Tape compiler and evaluator. Import `ScalarNode`, `LoweredScalarFn`, and `ScalarOperator` from `@danielsimonjr/mathts-expression`. Import `ScalarEvalError` from `./scalar-eval.js`. `@packageDocumentation` header.                                                                                                                                                                    |
| `functions/src/index.ts`                 | **Change.** Insert the export block after the `evaluateScalar` / `ScalarScope` export. If the M4 `paretoFront` block is already there, insert after it.                                                                                                                                                                                                                                          |
| `functions/tests/scalar-compile.test.ts` | **Add.** Import `{ describe, expect, it } from 'vitest'`. Import `compileScalar` and `ScalarEvalError` from `../src/scalar-compile.js` (the error class is re-exported from `scalar-eval.js`; import `ScalarEvalError` from `../src/scalar-eval.js` so the test asserts the existing class). Import `evaluateScalar` and `scalar` from `../src/scalar-eval.js`. Also assert the index re-export. |
| `functions/README.md`                    | **Change.** Extend the existing `scalar` / `evaluateScalar` bullet with one sentence: `` `compileScalar` evaluates the same tree over `Float64Array` columns and marks a row invalid where `evaluateScalar` would throw. ``                                                                                                                                                                      |
| `docs/reference/functions.md`            | **Change.** Add `compileScalar` to the curated `## Expression Evaluation` table, above the generated index.                                                                                                                                                                                                                                                                                      |
| `tools/generate-functions-reference.mjs` | **Change.** Append `'compileScalar'` to `DOMAIN_SUPPLEMENT['Expression Evaluation']`.                                                                                                                                                                                                                                                                                                            |
| `.changeset/scalar-compile-m3.md`        | **Add.** Contents in [Changeset](#changeset).                                                                                                                                                                                                                                                                                                                                                    |
| Generated docs and `docs/Architecture/*` | Same rule as M4: build `functions` before commit so the hook's `docs:functions` reads a fresh `dist`.                                                                                                                                                                                                                                                                                            |

Copy this regex into `scalar-compile.ts`. It is the one in `scalar-eval.ts` (`NUMERIC_LITERAL`). Do not export it from `scalar-eval.ts` just to share it; a one-line comment points at that constant.

```ts
const NUMERIC_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
```

## Exports

```ts
export { compileScalar } from './scalar-compile.js';
export type { CompileScalarOptions, ScalarBatchResult, CompiledScalar } from './scalar-compile.js';
```

Reuse `ScalarEvalError`. Do not add `ScalarCompileError`.

### Signatures and TSDoc

```ts
/**
 * Bindings for {@link compileScalar}.
 *
 * `variables` is the column order. `parameters` are free constants supplied
 * to each `evaluate` call (PySR's fitted constants; still `symbol` nodes).
 * `constants` are fixed numbers, for example `{ pi: Math.PI }`.
 *
 * A name may occur in only one of those three. Symbol lookup then follows
 * `evaluateScalar`: parameter, else column, else constant, else a numeric
 * literal spelling (`'2'`, `'-1'`, `'1e-3'`), else a compile-time
 * {@link ScalarEvalError}. `pi` and `e` are not literals.
 *
 * The node must already be a `ScalarNode`. A formula string, a
 * `transcendental` node, or an `abs` node is rejected; normalize with
 * `scalar.from` first.
 */
export interface CompileScalarOptions {
  readonly variables: readonly string[];
  readonly parameters?: readonly string[];
  readonly constants?: Readonly<Record<string, number>>;
}

/**
 * One batch. `values[i]` equals `evaluateScalar` for that row when `valid[i]`
 * is 1, including a stored `NaN`, `±Infinity`, or `-0` on a bare number or
 * symbol. `values[i]` is `NaN` when `valid[i]` is 0, which is exactly when
 * `evaluateScalar` throws. `allValid` is true when every `valid` byte is 1,
 * including when there are zero rows.
 */
export interface ScalarBatchResult {
  readonly values: Float64Array;
  readonly valid: Uint8Array;
  readonly allValid: boolean;
}

/** A compiled scalar. `variables` and `parameters` are copies made at compile time. */
export interface CompiledScalar {
  readonly variables: readonly string[];
  readonly parameters: readonly string[];
  /**
   * Evaluate every row. Does not throw because a row is non-finite.
   * Throws {@link ScalarEvalError} for a column or parameter mismatch, a bad
   * `out` length, or a non-number parameter or row binding that is not a
   * `Float64Array` column.
   * When `out.length ===` the row count, `values` is `out` and no second value
   * buffer is allocated.
   */
  evaluate(
    columns: readonly Float64Array[],
    params?: ArrayLike<number>,
    out?: Float64Array
  ): ScalarBatchResult;
  /**
   * One row, in `variables` order. Returns the same number `evaluateScalar`
   * would, including non-finite bare values. Throws {@link ScalarEvalError}
   * when the row is invalid or the binding is the wrong shape.
   */
  evaluateRow(row: ArrayLike<number>, params?: ArrayLike<number>): number;
}

/**
 * Compile `node` once. Unknown symbols and a `^` that does not have two
 * arguments throw {@link ScalarEvalError} here, not per row.
 * The compiled object is synchronous and not reentrant: one `evaluate` must
 * finish before the next starts on that object (the scratch tape is reused).
 */
export function compileScalar(node: ScalarNode, options: CompileScalarOptions): CompiledScalar;
```

## Register tape

Each stored node writes one register. Register count equals `scalar` node count of the stored tree (do not canonicalize). Scratch is one `Float64Array` of that length, allocated in `compileScalar` and reused for every row. `evaluate` of two different `CompiledScalar` objects does not share scratch.

| Instruction      | Effect on a row                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| `const` → dest   | `reg[dest] = value`, as stored, even when non-finite. Does not clear validity. |
| `column` → dest  | `reg[dest] = columns[index][row]`                                              |
| `param` → dest   | `reg[dest] = params[index]`                                                    |
| binary `+ - * /` | `left + right`, `left - right`, `left * right`, or `left / right`              |
| binary `^`       | `Math.pow(left, right)`                                                        |
| unary            | the table below                                                                |

Unary `fn` (the lowered name):

| `fn`    | Call                                      |
| ------- | ----------------------------------------- |
| `exp`   | `Math.exp`                                |
| `log`   | `Math.log` (natural; this is stored `ln`) |
| `log10` | `Math.log10`                              |
| `log2`  | `Math.log2`                               |
| `sin`   | `Math.sin`                                |
| `cos`   | `Math.cos`                                |
| `tan`   | `Math.tan`                                |
| `sinh`  | `Math.sinh`                               |
| `cosh`  | `Math.cosh`                               |
| `tanh`  | `Math.tanh`                               |
| `abs`   | `Math.abs`                                |

After every binary and unary instruction, if the row is still valid and the result is not a finite number (`typeof !== 'number'` or `!Number.isFinite`), set the row invalid and store `NaN` in that dest. Further instructions on an invalid row store `NaN` and stay invalid. This matches `requireFinite` after each step of a left fold, not only at the root.

Loads (`const`, `column`, `param`) do not apply that check. A root that is only a load returns the stored value and `valid` 1, even for `NaN` or `Infinity`. That is `evaluateScalar` of a number or symbol.

Empty and unary folds match `evalOp` in `scalar-eval.ts`:

| Node                     | Tape                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `+()` or `-()`           | const `0`                                                             |
| `*()` or `/()`           | const `1`                                                             |
| `+ - * /` with one arg   | that arg's register; no extra finite check                            |
| `+ - * /` with n≥2       | left fold. `+(a, b, c)` is `(a + b)` checked, then that `+ c` checked |
| `^` with 2 args          | one `Math.pow`                                                        |
| `^` with any other arity | throw at compile time                                                 |
| `call`                   | unary on the arg register                                             |

Compile-time `^` message: `evaluateScalar: '^' needs exactly 2 args, got ${n}.` Unknown `fn`: `evaluateScalar: unknown scalar function '${String(fn)}'.` Any other runtime `kind`: `compileScalar: node kind '${String(kind)}' is not a ScalarNode`. A string node: `compileScalar: node kind 'undefined' is not a ScalarNode` is acceptable if `kind` is read off a non-object; also accept throwing `ScalarEvalError` matching `/not a ScalarNode/` for `null`, arrays, and strings. The test uses a string and a `{ kind: 'transcendental', fn: 'ln', arg: { kind: 'number', value: 1 } }` cast.

### Symbol binding

At compile time, before the tape runs:

1. If `variables` or `parameters` contains a duplicate (`indexOf !== lastIndexOf`), throw `compileScalar: symbol '${name}' is listed more than once`.
2. For each symbol node, count how many of these are true: the name is in `variables`, the name is in `parameters`, `Object.prototype.hasOwnProperty.call(constants, name)`. Two or more throws the same "listed more than once" message. `hasOwnProperty` is required so a symbol `toString` with `constants = {}` is **not** bound to `Object.prototype.toString`.
3. Otherwise bind the first hit in this order: parameter index, column index, constant value. A constant whose own value is not a `number` throws `compileScalar: constant '${name}' is not a number`.
4. Otherwise, if `NUMERIC_LITERAL` matches and `Number(name)` is finite, bind that number as a const. This is how the symbol `'2'` becomes `2` when it is not in scope.
5. Otherwise throw `evaluateScalar: symbol '${name}' has no value (not in scope, not a numeric literal).` so callers can share the `evaluateScalar` handling.

`parameters` defaults to `[]` and `constants` defaults to `{}`. `compiled.variables` and `compiled.parameters` are shallow copies (`slice`). Mutating the caller's arrays after `compileScalar` returns does not change the tape.

### `evaluate` shape checks

Let `nParams = compiled.parameters.length` and `nVars = compiled.variables.length`.

| Condition                                                                                                      | Message                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `columns.length !== nVars`                                                                                     | `compileScalar: expected ${nVars} columns, got ${columns.length}`                                                                   |
| a column is not a `Float64Array` (`ArrayBuffer.isView` and the constructor name, or `instanceof Float64Array`) | `compileScalar: column ${i} must be a Float64Array`                                                                                 |
| `nVars > 0` and column lengths differ                                                                          | `compileScalar: columns must have the same length`                                                                                  |
| `nVars === 0`                                                                                                  | row count is **1**, and `columns` must be empty (the count check above already enforces that). One constant result, not a broadcast |
| `nVars > 0`                                                                                                    | row count is `columns[0].length`, which may be `0`                                                                                  |
| `params` omitted and `nParams === 0`                                                                           | allowed                                                                                                                             |
| `params` omitted and `nParams > 0`                                                                             | `compileScalar: expected ${nParams} parameters, got 0`                                                                              |
| `params` provided and `params.length !== nParams`                                                              | `compileScalar: expected ${nParams} parameters, got ${params.length}`                                                               |
| a parameter is not a `number`                                                                                  | `compileScalar: parameter ${i} is not a number`                                                                                     |
| `out` provided and `out.length !==` row count                                                                  | `compileScalar: out length ${out.length} does not match row count ${n}`                                                             |

`valid` entries are the numbers `0` and `1` only. `allValid` is `valid.every((v) => v === 1)` (true for length 0). When `out` is omitted, allocate `new Float64Array(n)`. When `out` matches, write into it and return it as `result.values` (`toBe` the same reference). Do not write into `columns` or `params`.

`evaluateRow` uses the same tape for one index. `row.length !== nVars` throws `compileScalar: expected ${nVars} row entries, got ${row.length}`. A non-number row entry throws `compileScalar: row entry ${i} is not a number`. Parameter checks match `evaluate`. On an invalid row throw `new ScalarEvalError('compileScalar: row produced a non-finite value.')`. On a valid row return the register value, preserving `-0` and `NaN`.

## Tests

### Hand-computed batches

Build nodes with `scalar` from `scalar-eval.ts`. Compare valid rows to `evaluateScalar` with `Object.is`, and also `toBe` the literals below so the table stands alone. Invalid rows: `evaluateScalar` throws `ScalarEvalError`, `valid[i] === 0`, and `Number.isNaN(values[i])`.

**Division** `/(x, y)`, variables `['x', 'y']`.

| Row | x    | y    | `valid` | `values`                       |
| --- | ---- | ---- | ------- | ------------------------------ |
| 0   | `8`  | `2`  | 1       | `4`                            |
| 1   | `1`  | `0`  | 0       | NaN (`1/0` is `Infinity`)      |
| 2   | `0`  | `0`  | 0       | NaN                            |
| 3   | `-4` | `2`  | 1       | `-2`                           |
| 4   | `0`  | `-1` | 1       | `-0` (`Object.is(0 / -1, -0)`) |
| 5   | `9`  | `3`  | 1       | `3`                            |

`allValid` is `false`. The same rows through `evaluateRow`: rows 0, 3, 4, 5 return the values (`Object.is` for `-0`); rows 1 and 2 throw `ScalarEvalError` matching `/non-finite/`.

**Power** `^(x, y)`, same variable order.

| Row | x    | y       | `valid` | `values`                         |
| --- | ---- | ------- | ------- | -------------------------------- |
| 0   | `-2` | `2`     | 1       | `4`                              |
| 1   | `-8` | `1 / 3` | 0       | NaN (`Math.pow(-8, 1/3)` is NaN) |
| 2   | `-4` | `0.5`   | 0       | NaN                              |
| 3   | `0`  | `0`     | 1       | `1` (`Math.pow(0, 0) === 1`)     |
| 4   | `0`  | `-1`    | 0       | NaN (`Infinity`)                 |

**Calls and overflow.** One column `x`.

| Expression         | x          | `valid` | `values`                                          |
| ------------------ | ---------- | ------- | ------------------------------------------------- |
| `call('ln', x)`    | `1`        | 1       | `0`                                               |
| `call('ln', x)`    | `Math.E`   | 1       | `1`                                               |
| `call('ln', x)`    | `0`        | 0       | NaN (`Math.log(0)` is `-Infinity`)                |
| `call('ln', x)`    | `-1`       | 0       | NaN                                               |
| `call('log', x)`   | `100`      | 1       | `2`                                               |
| `call('log10', x)` | `1000`     | 1       | `3`                                               |
| `call('log2', x)`  | `8`        | 1       | `3`                                               |
| `call('exp', x)`   | `0`        | 1       | `1`                                               |
| `call('exp', x)`   | `1`        | 1       | `Math.E` (`Object.is`)                            |
| `call('exp', x)`   | `709`      | 1       | `Math.exp(709)` which is `8.218407461554972e+307` |
| `call('exp', x)`   | `800`      | 0       | NaN                                               |
| `call('sin', x)`   | `0`        | 1       | `0`                                               |
| `call('sin', x)`   | `Infinity` | 0       | NaN                                               |
| `call('abs', x)`   | `-3`       | 1       | `3`                                               |
| `call('abs', x)`   | `-0`       | 1       | `+0` (`Object.is(Math.abs(-0), 0)`; not `-0`)     |
| `call('sinh', x)`  | `0`        | 1       | `0`                                               |

**Bare non-finite values stay valid.** Variables `['x']`, the node is the symbol `x`, column `Float64Array.of(NaN, Infinity, -0)`. `valid` is `[1, 1, 1]`, `allValid` is `true`, and the values are `Object.is` to `NaN`, `Infinity`, and `-0`. A number node `Infinity` with `variables: []` and `columns: []` returns one value `Infinity`, `valid` `[1]`.

**Left fold fails at the first non-finite step.** `+(number(1e308), number(1e308), number(-1e308))` with no variables: `1e308 + 1e308` is `Infinity`, so the row is invalid (`valid` 0, value NaN), not the third addend. `+(number(1), number(2), number(3))` is `6`. `-(number(4))` (one argument) is `4`. `+()` is `0`. `*()` is `1`.

**Mask is per row, not per batch.** `+(call('ln', x), y)` with

| x        | y    | `valid` | value |
| -------- | ---- | ------- | ----- |
| `1`      | `2`  | 1       | `2`   |
| `-1`     | `5`  | 0       | NaN   |
| `Math.E` | `-1` | 1       | `0`   |

### Bindings

| Case                                                                                                      | Expected                                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `*(symbol('a'), x) + b`, parameters `['a', 'b']`, variables `['x']`, column `[1, 2, 3]`, params `[10, 1]` | `[11, 21, 31]`, all valid                                  |
| same compiled object, second call params `[3, 0]`                                                         | `[3, 6, 9]` (parameters are not baked in)                  |
| `*(symbol('c'), x)`, `constants: { c: 3 }`, column `[2, 5]`                                               | `[6, 15]`                                                  |
| `*(symbol('2'), x)`, variables `['x']` only, column `[3, 4]`                                              | `[6, 8]` (literal spelling)                                |
| symbol `'2'` with scope-equivalent constant omitted and variables `[]`                                    | one value `2`                                              |
| symbol `'mystery'`                                                                                        | throws at **compile** time, `ScalarEvalError`, `/mystery/` |
| symbol `'pi'` with empty constants                                                                        | throws at compile time, `/no value/`                       |
| symbol `'toString'`, `constants: {}`                                                                      | throws at compile time, `/no value/` (not a prototype hit) |
| variables `['x', 'x']`                                                                                    | `/listed more than once/`                                  |
| variables `['x']` and parameters `['x']`                                                                  | `/listed more than once/`                                  |
| `constants: { c: '3' as unknown as number }`                                                              | `/not a number/`                                           |
| `^` with 3 number children, built as a cast object                                                        | throws at compile time, `/exactly 2 args/`                 |
| `compileScalar('x+1' as unknown as ScalarNode, { variables: [] })`                                        | `/not a ScalarNode/`                                       |
| transcendental `ln` object, same cast                                                                     | `/not a ScalarNode/`                                       |

After `compileScalar(..., { variables: vars })`, `vars.push('z')` leaves `compiled.variables` length unchanged, and `compiled.variables` is not the same reference as `vars`.

### Shape, reuse, purity

- Variables `['x', 'y']`, one column: `/expected 2 columns, got 1/`.
- Two columns of lengths 2 and 1: `/same length/`.
- A `number[]` cast to `Float64Array`: `/Float64Array/`.
- Parameters `['a']`, `evaluate` with no params: `/expected 1 parameters, got 0/`.
- Params `[1, 2]`: `/expected 1 parameters, got 2/`.
- `out` of length 1 when the column length is 2: `/out length 1 does not match row count 2/`.
- Column `new Float64Array(0)`: `values.length === 0`, `valid.length === 0`, `allValid === true`. Passing `out = new Float64Array(0)` returns that `out`.
- Division batch: preallocate `const out = new Float64Array(6)`, `evaluate(..., undefined, out).values` is `out` (`toBe`), and `out[0] === 4`.
- Deep-freeze the `ScalarNode` before `compileScalar`. Compilation does not throw, and a later `evaluate` still matches the table.
- `compileScalar` from `../src/index.js` is the same function as from `../src/scalar-compile.js`.

### Seeded parity sweep

This sweep is the differential check the roadmap asks for. The edge table above is the closed-form oracle. The sweep may call `evaluateScalar`; it must not call `compileScalar` to invent an expected number.

Use `mulberry32` from the M1 plan (copy the function into this test; do not import M1). A fresh `mulberry32(0x5ca1a)` yields `0.3941456207539886`, `0.4408325254917145`, `0.06790005695074797`, `0.0023013048339635134`.

A second fresh generator with the same seed builds **500** trees. `gen(rng, depth)`:

- if `depth === 0` or `rng() < 0.25`, leaf: `rng() < 0.5` selects symbol `x` or `y` by `rng() < 0.5`; otherwise a number from `[-2, -1, 0, 1, 2, 0.5]` by `Math.floor(rng() * 6)`.
- else if `rng() < 0.55`, a call. Pick `Math.floor(rng() * 12)` into `['exp', 'ln', 'log', 'log2', 'log10', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'abs']` and build it with `scalar.call`. `ln` is stored as natural `log`; `log` is stored as `log10`. Do not hand-write `fn: 'ln'` (that is not a lowered name).
- else a binary operator from `['+', '-', '*', '/', '^']` indexed by `Math.floor(rng() * 5)`, two children, `gen(rng, depth - 1)`.

Start each tree at depth 4. Compile with `variables: ['x', 'y']`.

Columns, length 64:

```ts
const x = new Float64Array(64);
const y = new Float64Array(64);
for (let i = 0; i < 64; i++) {
  x[i] = (i % 17) - 8;
  y[i] = ((i * 3) % 11) - 5;
}
x[60] = 0;
y[60] = 0;
x[61] = -1;
y[61] = 0.5;
x[62] = 800;
y[62] = 1;
x[63] = NaN;
y[63] = 1;
```

For each tree and each row `i`, `try` `evaluateScalar(tree, { x: x[i], y: y[i] })`. On success, `valid[i] === 1` and `Object.is(values[i], returned)`. On throw, the error is a `ScalarEvalError`, `valid[i] === 0`, and `Number.isNaN(values[i])`. Assert both a success and a throw occurred somewhere in the 500×64 cells (the specials at rows 60–63 plus random `log` / `^` make a throw expected; if a seed ever produced none, the test failed closed — this seed does produce throws). Assert the loop count is 500.

Also `evaluateRow([x[0], y[0]])` agrees with `evaluateScalar` on tree 0's first row, or both throw `ScalarEvalError`.

## Changeset

File `.changeset/scalar-compile-m3.md`:

```md
---
'@danielsimonjr/mathts-functions': minor
---

Add compileScalar, a batch ScalarNode evaluator with per-row validity that matches evaluateScalar.
```

Do not bump `expression`. No expression API change.

## Acceptance criteria

- [ ] `compileScalar` and the three types are exported from `@danielsimonjr/mathts-functions`.
- [ ] Every hand-computed row matches the tables under `Object.is` where valid, and is `valid === 0` plus NaN where `evaluateScalar` throws, including `0 / -1` → `-0`, `0^0` → `1`, `log(0)`, `exp(800)`, `(-8)^(1/3)`, and a bare `NaN` column staying valid.
- [ ] `out` of the right length is returned as `values`.
- [ ] Column-count, column-length, column-type, parameter-count, and `out`-length errors throw `ScalarEvalError` with the messages above.
- [ ] Unknown symbols and a bad `^` throw at compile time. `toString` is not read off the prototype. A formula string and a `transcendental` node are rejected.
- [ ] The node is not mutated. Parameters are re-read on each `evaluate`.
- [ ] The 500×64 sweep agrees with `evaluateScalar`, including failing rows, on seed `0x5CA1A`.
- [ ] No `eval`, `new Function`, or `node:` import in `scalar-compile.ts`.
- [ ] `bunx turbo typecheck --filter=@danielsimonjr/mathts-functions` reports 0 errors.
- [ ] `bunx turbo test --filter=@danielsimonjr/mathts-functions` passes.
- [ ] `functions` is built before commit. `docs:functions` lists `compileScalar` under Expression Evaluation.
- [ ] `check:duplicates:fast`, `check:browser-safety`, and `check:file-census` pass.
- [ ] The changeset above is present, bump type `minor`.
- [ ] No benchmark and no speed claim.

## Verification

```bash
bunx turbo typecheck --filter=@danielsimonjr/mathts-functions
bunx turbo test --filter=@danielsimonjr/mathts-functions
bunx turbo build --filter=@danielsimonjr/mathts-functions
bun run docs:functions
bun run docs:deps
```

`scalar-compile.test.ts` imports `../src`, so the package vitest run does not need `dist`. The pre-commit `docs:functions` step does. Build before committing.

## Locked decisions

1. **Number kernels are the raw JavaScript operations**, not `mathTyped`. That is what `evaluateScalar` executes for two `number`s (`a + b`, `Math.pow`, `Math.log`, `Math.log10`, `Math.sin`, …).
2. **`valid` means "evaluateScalar returns"**, not "the value is finite". A bare `NaN` or `Infinity` is valid. An operator or call that yields a non-finite number is invalid and stored as `NaN`.
3. **`^` arity and unknown symbols fail at compile time.** `evaluateScalar` would fail them on every row instead. The messages still start with `evaluateScalar:` so the text matches.
4. **No `scalar.from` inside `compileScalar`.** Pre-normalization shapes are rejected. This milestone does not depend on M1.
5. **A constant expression (`variables: []`) has one row.** It is not broadcast across a caller-chosen length.
6. **No speed claim** until a separate benchmark exists. This PR does not add one.
