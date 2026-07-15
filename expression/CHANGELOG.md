# @danielsimonjr/mathts-expression

## 0.6.4

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-core@0.10.0

## 0.6.3

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-core@0.9.0

## 0.6.2

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-core@0.8.0

## 0.6.1

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0

## 0.6.0

### Minor Changes

- fd3e417: Add two AST node serializers: `Node.toMarkdown()` (display/inline math wrapper over `toTex`) and `Node.toDOT()` (Graphviz digraph of the expression tree).

## 0.5.3

### Patch Changes

- Updated dependencies [cb4bebf]
- Updated dependencies [a5b5af6]
  - @danielsimonjr/mathts-core@0.6.0

## 0.5.2

### Patch Changes

- 3ad126d: Remove three superseded, test-only factory duplicates from `expression/src/function/`: `compile.ts` (`createCompile`), `evaluate.ts` (`createEvaluate`), and `help.ts` (`createHelp`). These were mathjs-lineage dependency-injection factories duplicating the active `compiler/compile.ts`, `evaluator/evaluate.ts`, and `Help.ts` — which use MathTS-native positional signatures and are what `functions`/`workbook` actually consume. They were unreachable from the package index (wiring them would have collided with the `createEvaluate` already exported by `evaluator/index.ts`) and exercised only by one test, now pruned to its surviving `createParser` block. With this, the expression package has **zero dormant files** — every source file is reachable from a public entry point. Published surface unchanged.

## 0.5.1

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.

## 0.5.0

### Minor Changes

- ce8f929: **Expression-language transforms wired** (the formerly-dormant `expression/src/transform` pocket — 25 transforms, mathjs-verified). Inside the expression language, semantics now match mathjs exactly (verified against mathjs 15 output): indices and dimensions are **one-based** (`A[1]` is the first element — previously zero-based, contradicting the parser's documented one-based design; `A[end]` works; `row(M, 1)`/`column(M, 1)` return the first row/column; `max`/`min`/`sum`/`mean`/`std`/`variance`/`cumsum` accept 1-based `dim` arguments — previously rejected), ranges include their end (`1:3` = `[1,2,3]`), map/filter/forEach callbacks receive one-based index arrays, and `and`/`or`/`??` short-circuit lazily (`rawArgs` — `true or undefinedVar` no longer throws). Each transform factory takes its base function as an **injected dependency** (no parallel implementation layer); the standalone compiler gained `rawArgs` and `end` support; the `MathJSDenseMatrix` bridge now invokes callbacks arity-appropriately (a typed 2-arg expression lambda previously threw "Too many arguments"). The programmatic API is unchanged — only the expression namespace gets transform semantics, exactly like mathjs. **This is a breaking change for expression strings that relied on the old zero-based indexing.**

### Patch Changes

- 598e72d: Wire the 92 formerly-dormant `embeddedDocs` entries (MathTS-native extensions: CAS/algebra, geometry, numeric, probability, signal, special) into the docs index — `help('polyFit')`, `help('gaussQuad')`, `help('besselJ0')`, etc. now work; previously these doc files existed but were invisible to `help()`. The one doc for a nonexistent function (`distribution`, a removed mathjs factory) was deleted rather than wired. A completeness test now pins that every documented function exists in the surface (docs never lie). Combined with the transform wiring, the expression package's dormant-file count drops 127 → ~4.

## 0.4.5

### Patch Changes

- Updated dependencies [779fcde]
  - @danielsimonjr/mathts-core@0.5.0

## 0.4.4

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.
- Updated dependencies [22427a8]
  - @danielsimonjr/mathts-core@0.4.1

## 0.4.3

### Patch Changes

- Updated dependencies [5611a77]
- Updated dependencies [25b80ed]
- Updated dependencies [d27e0a5]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-core@0.4.0

## 0.4.2

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.3.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-core@0.2.0

## 0.4.0

### Minor Changes

- - **feat (GC4):** export `embeddedDocs` (enables the `help()` function in the
    functions package).

## 0.3.0

### Minor Changes

- **`Node.toMathML()` — MathML serialization, alongside `.toTex()`/`.toHTML()`.** A per-node serializer method (each node implements `_toMathML()`; shared helpers in `utils/mathml.ts`) that renders an expression AST to a MathML fragment, which browsers typeset natively — zero external dependencies. Supporting helpers: `mathMLDocument(node)` wraps a fragment in a self-contained `<math>` element, `mathMLError(src)` reports a parse failure, and `escapeMathML` / `toMathMLSymbol` are exported for reuse.

  Renders fractions, powers, roots, `abs`, sub/superscripts, a full Greek-letter map, scientific-notation numbers (`8.85e-12` → mantissa × 10⁻¹²), prefix **and** postfix unary operators (`5!`), assignments, and chained relationals — with precedence-aware grouping. All text is escaped, and it never throws (an unhandled node or a render error degrades to `<mtext>`/`<merror>`).

## 0.2.4

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.2.3

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## Unreleased

### Tests

- Raise vitest line coverage of the active expression modules to ≥90% (overall
  subtotal ~96%). Added test suites for the parser grammar, AST node
  construction / `_compile` / `toString` / `toTex` / `toHTML` rendering
  (Operator, Function, Accessor, Index, Assignment, Conditional, Constant nodes
  and the base `Node`), the tree-walking compiler, the standalone evaluator's
  AST validator, the `function/` typed-function factories (`compile`,
  `evaluate`, `parser`, `help`), the `Help` class, and the `utils/` helpers
  (array, collection, number, bignumber formatter, string, object, factory).
  Added a shared `tests/helpers/bootstrap.ts` that wires node constructors and
  `parse`/`evaluate` from source so coverage attributes to `expression/src`.
  Added the active expression modules to the root `vitest.config.ts` coverage
  allowlist. Two files remain below 90% for documented reasons: `utils/number.ts`
  (dead `Math.*` polyfill fallback bodies that never execute on modern
  runtimes) and `utils/bignumber/formatter.ts` (binary/octal/hex BigNumber
  formatting that the current core `BigNumber` does not support). No production
  code changed; the security sandbox invariants are preserved and additionally
  asserted.

## 0.2.2

### Patch Changes

- Export `createParser` (the `math.parser()` instance factory) from the package entry. It was already implemented in `src/function/parser.js` but absent from the public index; this makes the stateful, scope-aware Parser instance factory available to consumers (and to the new `@danielsimonjr/mathts-parser` package).

## 0.2.1

### Patch Changes

- Pin internal `@danielsimonjr/mathts-*` dependencies to exact versions instead of `*`, so a matched package set always installs together.
- Rebuilt against `@danielsimonjr/mathts-core@0.1.3`, which restores the missing `Unit` export.

## 0.2.0

### Minor Changes (Security — BREAKING)

- 6e76d62: Restore RCE sandbox in tree-walking compiler. `evaluate()` and
  `compileExpression()` now default-reject `AssignmentNode`,
  `FunctionAssignmentNode`, and `FunctionNode` calls to denylisted builtins
  (`import`, `createUnit`, `evaluate`, `parse`, `compile`, `simplify`,
  `derivative`, `help`, `chain`). All five compile sites
  (`compileAccessorNode`, `compileAssignmentNode`, `compileObjectNode`,
  `compileSymbolNode`, `compileFunctionNode`) route through
  `getSafeProperty` / `setSafeProperty` / `getSafeMethod`. Hosts that need
  the legacy permissive behaviour can opt out with `{ unsafe: true }`.
  Adds `expression/tests/security/sandbox.test.ts` (13 tests).

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-core@0.1.1
