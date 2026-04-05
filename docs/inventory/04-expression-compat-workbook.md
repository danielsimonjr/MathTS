# Expression, Compat & Workbook Inventory

## Expression Package (`@danielsimonjr/mathts-expression`)

### Entry Point Exports

`expression/src/index.ts` re-exports from six modules:

```
export * from './types.js';
export * from './keywords.js';
export * from './operators.js';
export * from './parse.js';       // createParse (1885-line factory)
export * from './Parser.js';      // createParserClass
export * from './Help.js';
```

No `@danielsimonjr/mathts-core` or `@danielsimonjr/mathts-matrix` imports — the expression package is self-contained, using its own internal `utils/factory.ts`, `utils/is.ts`, `utils/collection.ts`, etc.

### Node Types

| Node | Lines | Key Export |
|------|-------|------------|
| `Node.ts` | 408 | `createNode`, `MathNode`, `CompiledExpression`, `StringOptions` |
| `OperatorNode.ts` | 738 | `createOperatorNode` |
| `FunctionNode.ts` | 540 | `createFunctionNode` |
| `RangeNode.ts` | 330 | `createRangeNode` |
| `AssignmentNode.ts` | 330 | `createAssignmentNode` |
| `ConditionalNode.ts` | 282 | `createConditionalNode` |
| `IndexNode.ts` | 269 | `createIndexNode` |
| `FunctionAssignmentNode.ts` | 269 | `createFunctionAssignmentNode` |
| `RelationalNode.ts` | 256 | `createRelationalNode` |
| `AccessorNode.ts` | 254 | `createAccessorNode` |
| `ObjectNode.ts` | 229 | `createObjectNode` |
| `ArrayNode.ts` | 183 | `createArrayNode` |
| `ConstantNode.ts` | 187 | `createConstantNode` |
| `ParenthesisNode.ts` | 177 | `createParenthesisNode` |
| `BlockNode.ts` | 197 | `createBlockNode` |
| `SymbolNode.ts` | 234 | `createSymbolNode` |

### Parser

- `parse.ts`: 1885 lines — exports `createParse`, the main tokenizer/parser factory
- `Parser.ts`: 203 lines — exports `createParserClass`, the stateful REPL-style parser

### Support Subdirectories

| Directory | Status |
|-----------|--------|
| `src/compiler/` | Empty (placeholder) |
| `src/evaluator/` | Empty (placeholder) |
| `src/parser/` | Empty (placeholder) |
| `src/function/` | `compile.ts`, `evaluate.ts`, `help.ts`, `parser.ts` |
| `src/utils/` | `array.ts`, `bignumber/`, `collection.ts`, `customs.ts`, `factory.ts`, `is.ts`, `latex.ts`, `map.ts`, `number.ts`, `object.ts`, `print.ts`, `scope.ts`, `string.ts`, `switch.ts` |
| `src/transform/` | 25 transforms — **excluded from tsconfig and build** |
| `src/embeddedDocs/` | Embedded docs — **excluded from tsconfig and build** |

### Transforms (dormant — excluded from build via `tsconfig.json`)

`and`, `bitAnd`, `bitOr`, `column`, `concat`, `cumsum`, `diff`, `filter`, `forEach`, `index`, `map`, `mapSlices`, `max`, `mean`, `min`, `nullish`, `or`, `print`, `quantileSeq`, `range`, `row`, `std`, `subset`, `sum`, `variance`

(25 total — these are the expression-evaluation counterparts to the dormant synced factories in `functions/src/`)

### Integration Status

- **Builds**: Yes — `dist/index.js` and `dist/index.d.ts` exist. Uses `strict: false`.
- **Tests**: 0 — `expression/tests/` directory does not exist; CLAUDE.md lists expression as a package without tests.
- **Connected to core**: No — the expression package has no `@danielsimonjr/mathts-core` imports. It uses its own internal factory pattern copied from mathjs. Integration with the MathTS type system is not yet wired.
- **Build note**: Listed as "build skipped, incomplete" in CLAUDE.md. The `compiler/`, `evaluator/`, and `parser/` subdirectories are empty stubs. TODOs exist in `parse.ts`, `Parser.ts`, `node/IndexNode.ts`, and `function/help.ts`.

---

## Compat Package (`@danielsimonjr/mathts-compat`)

### Exports

`compat/src/index.ts` (293 lines) exports:
- `create(config?)` — factory returning a `MathInstance`
- `all` — empty record (a stub; `create()` ignores it and wires everything by default)
- Types: `MathJSConfig`, `MathInstance`
- Constants: `I`, `COMPLEX_ZERO`, `COMPLEX_ONE`, `FRACTION_ZERO`, `FRACTION_ONE`, `BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_PI`, `BIGNUMBER_E`
- Re-exports from `./shims.js` (all shim functions, see below)
- Re-exports from `@danielsimonjr/mathts-core`: `Complex`, `Fraction`, `BigNumber`
- Re-exports from `@danielsimonjr/mathts-matrix`: `DenseMatrix`, `SparseMatrix`
- Re-exports from `@danielsimonjr/mathts-parallel`: `computePool`

### What's Wired vs Stub

All functions in `shims.ts` (505 lines) are wired to real implementations:

| Category | Functions | Status |
|----------|-----------|--------|
| Construction | `complex`, `fraction`, `bignumber`, `matrix`, `sparse` | Wired to `@danielsimonjr/mathts-core` and `@danielsimonjr/mathts-matrix` |
| Basic arithmetic | `add`, `subtract`, `multiply`, `divide`, `pow`, `sqrt`, `abs`, `exp`, `log` | Wired to `@danielsimonjr/mathts-functions` typed dispatch |
| Trigonometry | `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2` | Wired (`asin/acos/atan` wrap `Math.*`) |
| Statistics | `sum`, `mean`, `min`, `max` | Wired |
| Number theory | `gcd`, `lcm` | Wired |
| Rounding | `round`, `floor`, `ceil` | Wired |
| Complex ops | `conj`, `re`, `im`, `arg` | Wired, throw `TypeError` for wrong types |
| Matrix ops | `transpose`, `det`, `identity`, `zeros`, `ones`, `size` | Wired — `det` uses LU decomposition |
| Type guards | `isComplex_`, `isFraction_`, `isBigNumber_`, `isNumber_`, `isMatrix` | Wired |
| Constants | `i`, `pi`, `e`, `phi`, `tau`, `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2`, `SQRT1_2`, `Infinity_`, `NaN_` | All wired to `Math.*` or `@danielsimonjr/mathts-core` |
| `shims` object | Aggregated map of all the above | Wired (`stub_markers: 1` is a false positive from the inventory script detecting a comment) |

The `all` constant is an empty `{}` object — `create()` wires everything regardless of what is passed. This differs from mathjs's selective factory pattern, where `all` contains actual factory functions.

### Test Coverage

Two test files, ~87 total `it()` cases:

- `compat/tests/compat.test.ts` (45 `it()` calls): Tests `create()` factory, `complex()`, `fraction()`, `bignumber()`, `matrix()`, `sparse()`, matrix operations, complex operations, type checking, constants, and the `MathInstance` API surface.
- `compat/tests/shims.test.ts` (42 `it()` calls): Tests inverse trig, arithmetic, trig, statistics, number theory, rounding, `det()` edge cases, complex error cases, additional constants, and the `shims` object key set.

---

## Workbook Package (`@danielsimonjr/mathts-workbook`)

### Structure

| File | Lines | Role |
|------|-------|------|
| `src/types.ts` | 103 | Type definitions for all core domain objects |
| `src/parser.ts` | 106 | YAML parsing/serialization — `parseWorkbook`, `serializeWorkbook` (serialize is a stub) |
| `src/graph.ts` | 129 | Dependency graph — `buildDependencyGraph`, `topologicalSort`, `getDependents`, `detectCycles` |
| `src/executor.ts` | 161 | `WorkbookExecutor` class and `createExecutor` factory |
| `src/cli.ts` | 130 | CLI entry point for `.mtsw` files — run/validate/graph/new subcommands (mostly TODOs) |
| `src/index.ts` | 28 | Public package exports |

### Types

Key interfaces from `workbook/src/types.ts`:

- `CellType`: `'code' | 'markdown' | 'data' | 'result' | 'comment' | 'export'`
- `ExecutionMode`: `'reactive' | 'sequential' | 'manual'`
- `WorkbookMetadata`: title, version, author, created, modified, executionMode, config
- `RuntimeConfig`: timeout, maxIterations, allowNetworkAccess, allowFileAccess
- `Cell`: id, type, content, output, error, dependencies (string[]), metadata (tags, cacheable, etc.)
- `Workbook`: metadata, cells (Cell[]), variables (Record)
- `ParseResult`: workbook, errors[], warnings[]
- `WorkbookEvent`: type `'cell:start' | 'cell:success' | 'cell:error' | 'cell:stale' | 'workbook:complete'`
- `DependencyNode`: cellId, dependsOn (string[]), dependents (string[])
- `DependencyGraph`: nodes map, order (topological sort result)

### Executor

`WorkbookExecutor` class (`workbook/src/executor.ts`):

```typescript
export class WorkbookExecutor {
  async runAll(): Promise<void>           // runs all cells in topological order
  async runCell(cellId: string): Promise<unknown>  // runs single cell + propagates
  private async executeCell(cell: Cell): Promise<unknown>
  private async executeCode(_cell: Cell): Promise<unknown>  // STUB — throws
  private async executeData(cell: Cell): Promise<unknown>   // parses YAML/JSON data
}
export function createExecutor(workbook: Workbook): WorkbookExecutor
```

Execution modes (reactive/sequential/manual) are defined in types but not yet differentiated in the executor logic. Event emission works via `on()`.

### Known Stubs / TODOs

- `executeCode()` throws `'Code execution not yet implemented'` — sandboxed code execution is the core missing piece
- `serializeWorkbook()` throws `'serializeWorkbook not yet implemented'`
- CLI `run`, `validate`, `graph`, `new` subcommands are all TODO stubs

### Integration Status

- **Builds**: Yes — package builds to two entry points (`src/index.ts` and `src/cli.ts`)
- **Tests**: 50 tests across 3 files (executor: 14, graph: 18, parser: 18) — covers the implemented infrastructure
- **Connected to core**: Only via `@danielsimonjr/mathts-core` (listed as dependency). The executor does not yet call `@danielsimonjr/mathts-functions` or evaluate any math expressions.
- **No expression package integration** — workbook does not import `@danielsimonjr/mathts-expression`
