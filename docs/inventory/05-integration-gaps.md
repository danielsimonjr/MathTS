# Integration Gaps Analysis

## How mathjs Factories Work

The synced mathjs code uses a **factory-with-dependency-injection** pattern. Each function is created by a factory that declares its name, dependencies, and implementation:

```typescript
// functions/src/arithmetic/add.ts
const name = 'add'
const dependencies = ['typed', 'matrix', 'addScalar', 'equalScalar',
                      'DenseMatrix', 'SparseMatrix', 'concat', 'nodeOperations']

export const createAdd = factory(name, dependencies,
  ({ typed, matrix, addScalar, equalScalar, DenseMatrix, SparseMatrix, concat, nodeOperations }) => {
    // Returns a typed-function with signatures for number, BigNumber, Complex,
    // Fraction, Matrix, Array, Unit, etc.
    return typed(name, { ... })
  })
```

Key characteristics:

- **`factory()`** from `functions/src/utils/factory.ts` wraps the creator, attaching `.fn`, `.dependencies`, `.isFactory` metadata
- **`typed`** is the mathjs typed-function instance (NOT `@danielsimonjr/mathts-core`'s `mathTyped`). It knows about `Matrix`, `DenseMatrix`, `SparseMatrix`, `BigNumber`, `Complex`, `Fraction`, `Unit`, `Index`, `Range`, etc.
- **Dependencies are injected** by the `create()` bootstrap in `functions/src/core/create.ts`, which resolves them from the math instance namespace
- **`factoriesAny.ts`** exports 303 factory creators, organized by category
- **`create()`** iterates factories, calls `factory(math)` passing the `math` instance as the scope, and attaches results to `math.*`

## How Native Typed Functions Work

The native MathTS code uses a **direct typed-function dispatch** pattern:

```typescript
// functions/src/typed/arithmetic.ts
import { mathTyped, Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

export const add = mathTyped('add', {
  'number, number': (a, b) => a + b,
  'Complex, Complex': (a, b) => a.add(b),
  'Fraction, Fraction': (a, b) => a.add(b),
  'BigNumber, BigNumber': (a, b) => a.add(b),
  'Float64Array, Float64Array': async (a, b) => (await computePool.add(a, b)).result,
});
```

Key characteristics:

- Uses `@danielsimonjr/mathts-core`'s **`mathTyped`** singleton, which is a `typed-function` instance pre-configured with MathTS type tests for `Complex`, `Fraction`, `BigNumber`
- **No dependency injection** -- imports are static ES modules
- **Parallel-first**: Float64Array operations use `@danielsimonjr/mathts-parallel`'s ComputePool for worker-based parallelism
- **No Matrix support**: native typed functions handle scalars and Float64Array only -- no `DenseMatrix` or `SparseMatrix` signatures
- Only 4 modules active: `arithmetic.ts`, `trigonometry.ts`, `statistics.ts`, `signal.ts` (exported from `functions/src/typed/index.ts`)

## The Gap

There are **5 fundamental disconnects** between the two systems:

### 1. Two Separate `typed-function` Instances

| Aspect         | Native (`@danielsimonjr/mathts-core`)                                                                                                                             | Synced (mathjs)                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instance       | `mathTyped` singleton                                                                                                                                             | Created per `create()` call via `createTyped` factory                                                                                                                                |
| Types known    | `Complex`, `Fraction`, `BigNumber`, `number`, `bigint`, `boolean`, `string`, `Date`, `RegExp`, `null`, `undefined`, `Array`, `Float64Array`, `Object`, `Function` | All of the above plus `Matrix`, `DenseMatrix`, `SparseMatrix`, `Unit`, `Index`, `Range`, `ResultSet`, `Help`, `Chain`, `Node` (all AST types), `ObjectWrappingMap`, `PartitionedMap` |
| Type detection | `instanceof` checks against `@danielsimonjr/mathts-core` classes                                                                                                  | Duck-typing via constructor prototype properties (e.g., `x.constructor.prototype.isBigNumber`)                                                                                       |
| Source         | `core/src/typed/mathts-typed.ts`                                                                                                                                  | `functions/src/core/function/typed.ts`                                                                                                                                               |

**Impact**: The synced `createTyped` factory constructs its own typed-function instance with ~40 type tests using mathjs-style duck typing. The native `mathTyped` has ~15 type tests using `instanceof`. These two instances are **incompatible** -- a `@danielsimonjr/mathts-core` `Complex` will NOT be recognized by mathjs's `isComplex` check, and vice versa.

### 2. Two Separate Type Hierarchies

| Type         | Native (`@danielsimonjr/mathts-core`)                                     | Synced (mathjs factories)                                                                    |
| ------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Complex      | `core/src/types/Complex.ts` -- custom class with `.add()`, `.mul()`, etc. | `functions/src/type/complex/Complex.ts` -- wraps `complex.js` npm package                    |
| Fraction     | `core/src/types/Fraction.ts` -- custom class                              | `functions/src/type/fraction/Fraction.ts` -- wraps `fraction.js` npm package                 |
| BigNumber    | `core/src/types/BigNumber.ts` -- custom class                             | `functions/src/type/bignumber/BigNumber.ts` -- wraps `decimal.js` npm package                |
| DenseMatrix  | `matrix/src/types/DenseMatrix.ts` -- `Float64Array`-backed, row-major     | `functions/src/type/matrix/DenseMatrix.ts` -- nested `Array`-backed, column-major compatible |
| SparseMatrix | `matrix/src/types/SparseMatrix.ts` -- CSC format                          | `functions/src/type/matrix/SparseMatrix.ts` -- CSC format (similar API)                      |

**Impact**: Every factory expects types with specific APIs (e.g., `Complex` must have `.re`, `.im` from `complex.js`; `DenseMatrix` must have `.storage()`, `._data`, `._size`). Native types have different internal structures and APIs.

### 3. Two Separate Factory Registries

| Aspect        | Native (`@danielsimonjr/mathts-core`)                                                            | Synced (mathjs)                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Registry      | `FunctionRegistry` class in `core/src/factory/factory.ts`                                        | Implicit -- `create()` in `functions/src/core/create.ts` attaches to `math` namespace       |
| Resolution    | `registry.get(name)` with circular dependency detection                                          | `factory(math)` -- each factory gets the full `math` scope object                           |
| Configuration | `MathTSConfig` (includes `preferredBackend`, `wasmThreshold`, `gpuThreshold`, `parallelEnabled`) | `ConfigOptions` (mathjs standard: `precision`, `matrix`, `number`, `epsilon`, `randomSeed`) |

**Impact**: The native `FunctionRegistry` uses a different `FactoryFunction` interface (`{ name, dependencies, factory }`) than the mathjs `factory()` output (`{ fn, dependencies, isFactory: true, (scope) => result }`). They cannot interoperate without an adapter.

### 4. Matrix Architecture Gap

The native `@danielsimonjr/mathts-matrix` DenseMatrix:

- Backed by `Float64Array` (row-major), numbers only
- No `storage()` method -- uses `type` property (`'DenseMatrix'`)
- No `._data` or `._size` internal properties
- No `datatype()` method
- No `create()` method for constructing from data objects
- API: `get(row, col)`, `set(row, col, val)`, `toArray()`, `forEach()`, `map()`

The synced mathjs DenseMatrix expects:

- Backed by nested `Array<any>` (supports mixed types)
- `storage()` returns `'dense'`
- `._data` and `._size` internal properties accessed by matrix algorithms
- `datatype()` returns element type string
- `create(data)` factory method
- Complex indexing with `Index` objects, `subset()`, `resize()`, `reshape()`
- Matrix algorithm suite (`matAlgo01xDSid`, etc.) operates on internal `._data`/`._values`/`._ptr`

**Impact**: The 42 matrix factory functions and all matrix algorithms (`matAlgo*`) directly access internal matrix properties. The native `DenseMatrix` has none of these internals.

### 5. Missing Subsystems

Types/subsystems required by factories but not present in native MathTS:

| Subsystem             | Required by                                                       | Status                                                     |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| **Unit**              | 2 factories + conversions in typed, 4+ physics constant factories | Not implemented                                            |
| **Index**             | 15+ factories (subset, column, row, etc.)                         | Not implemented (native uses `[row, col]`)                 |
| **Range**             | Index, expressions                                                | Not implemented                                            |
| **Chain**             | 2 factories, expression chaining                                  | Not implemented                                            |
| **Node (AST)**        | 48 expression factories (16 node types + parser + 25 transforms)  | `expression/` package exists but build skipped, incomplete |
| **ResultSet**         | 1 factory                                                         | Not implemented                                            |
| **Help**              | 1 factory                                                         | Not implemented                                            |
| **ObjectWrappingMap** | Internal to several factories                                     | Not implemented natively                                   |

## Factory Bootstrap Chain

The mathjs `create()` function bootstraps as follows:

1. **`factoriesAny.ts`** (or `factoriesNumber.ts`) exports all 303 `createXxx` factory creators
2. **`create(factories, config)`** is called with the full set
3. `create()` builds a `math` namespace object with type-checking functions (`isNumber`, `isComplex`, etc.)
4. `create()` sets up `math.config`, `math.expression.transform`, event emitter
5. `math.import(factories)` iterates factories:
   - For each factory with `.isFactory === true`, calls `factory(math)` passing the `math` scope
   - The factory resolves its dependencies from `math.*` (e.g., `math.typed`, `math.addScalar`)
   - The factory returns its function, which is attached to `math[name]`
6. **Order matters**: `createTyped` must run first (provides `math.typed`), then type classes (`BigNumber`, `Complex`, `Fraction`, `Matrix`, `DenseMatrix`, `SparseMatrix`), then scalar functions (`addScalar`, `equalScalar`, `multiplyScalar`), then composite functions (`add`, `multiply`, etc.)

### What's Missing for Integration

1. **Bridge typed-function instances**: Either unify the two typed-function instances or register native types into the synced typed instance
2. **Bridge type classes**: Make native `Complex`/`Fraction`/`BigNumber` pass mathjs duck-type checks OR use mathjs type classes and add native methods
3. **Bridge matrix types**: Either wrap native `DenseMatrix` to expose mathjs internal API, or use the synced `DenseMatrix` and add backend delegation
4. **Wire the factory registry**: Connect `core/src/factory/FunctionRegistry` to the synced `factory()` pattern
5. **Implement missing subsystems**: Unit, Index, Range at minimum

## Recommended Activation Order

### Phase 1: Scalar-Only Factories (56 leaf factories)

Activate factories that depend only on `typed` and `config` -- these need no matrix or other function dependencies. Requires bridging the typed-function instance only.

**Factories**: `addScalar`, `multiplyScalar`, `subtractScalar`, `equalScalar`, `abs`, `exp`, `cube`, `square`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `atan`, `asinh`, `conj`, `re`, `im`, `arg`, `not`, `bitNot`, `clone`, `typeOf`, `format`, `print`, `combinations`, `combinationsWithRep`, `erf`, `isNaN`, `isNegative`, `isNumeric`, `isPositive`, `isPrime`, `isBounded`, `isFinite`, `isInteger`, `size`, `flatten`, `squeeze`, etc.

**Prerequisite**: Bridge typed-function type detection so native `Complex`/`Fraction`/`BigNumber` are recognized.

### Phase 2: Core Arithmetic Composites (adds ~40 factories)

`add`, `subtract`, `multiply`, `divide`, `pow`, `mod`, `gcd`, `lcm`, `nthRoot`, `sqrt`, `log`, `log2`, `log10`, `cbrt`, `ceil`, `floor`, `round`, `fix`, `sign`, `xgcd`, `invmod`, `unaryMinus`, `unaryPlus`, `expm1`, `bitAnd`, `bitOr`, `bitXor`, `leftShift`, `rightShift`.

**Prerequisites**: Phase 1 + matrix constructor + `DenseMatrix`/`SparseMatrix` type classes + `concat` + matrix algorithm helpers.

### Phase 3: Relational & Logical (adds ~17 factories)

`equal`, `unequal`, `smaller`, `smallerEq`, `larger`, `largerEq`, `compare`, `compareNatural`, `compareText`, `deepEqual`, `and`, `or`, `xor`.

**Prerequisites**: Phase 2 + matrix algorithms.

### Phase 4: Matrix Operations (adds ~42 factories)

`det`, `inv`, `pinv`, `trace`, `transpose`, `diag`, `cross`, `dot`, `eye/identity`, `ones`, `zeros`, `range`, `reshape`, `resize`, `subset`, `column`, `row`, `sort`, `unique`, `count`, `kron`, `ctranspose`, `sqrtm`, `expm`, `matPow`, `sylvester`.

**Prerequisites**: Phase 3 + `Index`, `Range` types + full matrix algorithm suite.

### Phase 5: Statistics & Probability (adds ~27 factories)

`sum`, `prod`, `min`, `max`, `mean`, `median`, `mode`, `variance`, `std`, `quantileSeq`, `cumsum`, `mad`, `norm`, `factorial`, `gamma`, `permutations`, `multinomial`, `random`, `randomInt`, `pickRandom`, `stirlingS2`, `bellNumbers`, `catalan`, `composition`, `zeta`.

**Prerequisites**: Phase 4 (some depend on matrix operations).

### Phase 6: Algebra (adds ~20 factories)

`simplify`, `derivative`, `rationalize`, `lup`, `lu`, `lsolve`, `usolve`, `lusolve`, `slu`, `qr`, `eigs`.

**Prerequisites**: Phases 1-5 + expression Node classes.

### Phase 7: Expression Engine (adds ~48 factories)

Parser, evaluator, 16 node types, 25 transform functions, `Help`, `Chain`.

**Prerequisites**: All previous phases + `Node` hierarchy, `Parser` class.

### Phase 8: Units (adds ~6+ factories)

`createUnit`, `splitUnit`, `Unit` class, physical constants.

**Prerequisites**: Phase 2.

## Effort Estimate by Category

| Category                                                 | Factories          | Key Dependencies                    | Effort                        | Priority | Phase               |
| -------------------------------------------------------- | ------------------ | ----------------------------------- | ----------------------------- | -------- | ------------------- |
| **Type bridge** (typed-function unification)             | 0 (infrastructure) | typed-function, core types          | **High** (2-3 weeks)          | **P0**   | Pre-req             |
| **Scalar arithmetic** (`addScalar`, `abs`, etc.)         | 56                 | typed only                          | **Low** (1 week after bridge) | **P1**   | 1                   |
| **Matrix type bridge** (DenseMatrix/SparseMatrix compat) | 0 (infrastructure) | matrix package, 11 matrix utilities | **High** (3-4 weeks)          | **P1**   | Pre-req for Phase 2 |
| **Arithmetic composites** (`add`, `multiply`, etc.)      | ~40                | matrix, matAlgo\*, equalScalar      | **Medium** (2 weeks)          | **P2**   | 2                   |
| **Relational** (`equal`, `compare`, etc.)                | 13                 | matrix, typed                       | **Low** (1 week)              | **P3**   | 3                   |
| **Logical** (`and`, `or`, `xor`, `not`)                  | 5                  | typed                               | **Low** (days)                | **P3**   | 3                   |
| **Bitwise**                                              | 7                  | typed                               | **Low** (days)                | **P3**   | 3                   |
| **Trigonometry**                                         | 25                 | typed, Complex, BigNumber           | **Low** (1 week)              | **P2**   | 2                   |
| **Matrix operations**                                    | 42                 | Index, Range, matrix suite          | **High** (3-4 weeks)          | **P3**   | 4                   |
| **Statistics**                                           | 13                 | matrix, arithmetic composites       | **Medium** (1 week)           | **P3**   | 5                   |
| **Probability**                                          | 14                 | typed, arithmetic                   | **Medium** (1 week)           | **P3**   | 5                   |
| **Combinatorics**                                        | 4                  | typed                               | **Low** (days)                | **P4**   | 5                   |
| **Complex**                                              | 4                  | typed, Complex class                | **Low** (days)                | **P2**   | 1                   |
| **String**                                               | 5                  | typed                               | **Low** (days)                | **P4**   | 1                   |
| **Special**                                              | 2                  | typed                               | **Low** (days)                | **P4**   | 1                   |
| **Set**                                                  | 10                 | matrix, Index                       | **Medium** (1 week)           | **P4**   | 4                   |
| **Geometry**                                             | 2                  | matrix                              | **Low** (days)                | **P4**   | 4                   |
| **Signal**                                               | 2                  | typed, matrix                       | **Low** (days)                | **P3**   | 5                   |
| **Algebra**                                              | 20                 | Node, matrix, arithmetic            | **High** (3-4 weeks)          | **P5**   | 6                   |
| **Unit**                                                 | 6+                 | typed, config                       | **High** (3-4 weeks)          | **P5**   | 8                   |
| **Expression**                                           | 48                 | Node hierarchy, parser              | **Very High** (6-8 weeks)     | **P6**   | 7                   |
| **Numeric**                                              | 1                  | typed                               | **Low** (days)                | **P4**   | 1                   |

## Critical Path Summary

```
typed-function bridge (P0, 2-3 weeks)
    |
    v
56 leaf factories (P1, 1 week)
    |
    +---> matrix type bridge (P1, 3-4 weeks)
    |         |
    |         v
    |     ~65 composite factories (P2, 3 weeks)
    |         |
    |         v
    |     Index/Range types (P3, 2 weeks)
    |         |
    |         v
    |     ~42 matrix factories (P3, 3 weeks)
    |         |
    |         v
    |     ~27 stats/probability (P3, 2 weeks)
    |         |
    |         v
    |     ~20 algebra factories (P5, 3 weeks)
    |         |
    |         v
    |     ~48 expression factories (P6, 6-8 weeks)
    |
    +---> Unit system (P5, independent track, 3-4 weeks)
```

**Total estimated effort**: 6-9 months for full activation, with useful milestones at each phase.

## Recommended Integration Strategy

### Option A: Adapter Pattern (Lower risk, higher ongoing cost)

Create adapter layers that wrap native types to satisfy mathjs duck-typing expectations:

- `ComplexAdapter` wraps `@danielsimonjr/mathts-core` `Complex` with `complex.js` API surface
- `DenseMatrixAdapter` wraps `@danielsimonjr/mathts-matrix` `DenseMatrix` with `._data`, `.storage()`, etc.
- Register adapters in the synced typed-function instance

**Pro**: Activates factories without modifying them. **Con**: Every native type needs a wrapper, performance overhead, two parallel type hierarchies forever.

### Option B: Converge Types (Higher risk, cleaner long-term)

Replace native type implementations with the mathjs type classes (which use battle-tested `complex.js`, `fraction.js`, `decimal.js`), then add native extensions:

- Use `complex.js` as the Complex implementation, add WASM-accelerated operations
- Use mathjs `DenseMatrix` as the base, add backend delegation (JS/WASM/GPU) for large operations
- Use mathjs `typed` factory as the typed-function instance, register parallel operation signatures

**Pro**: Single type system, direct factory activation. **Con**: Requires rewriting native typed functions, potential loss of Float64Array-backed matrix performance.

### Option C: Hybrid (Recommended)

1. Use the mathjs typed-function instance (`createTyped`) as the single dispatch system
2. Register native `@danielsimonjr/mathts-core` types into it using `typed.addType()`
3. Keep native `DenseMatrix` for Float64Array operations, create a mathjs-compatible `DenseMatrix` subclass or wrapper for factory consumption
4. Progressively activate factories while maintaining parallel-first native functions as optimized overrides

**Pro**: Incremental, preserves both performance paths. **Con**: Careful coordination needed to avoid signature conflicts.
