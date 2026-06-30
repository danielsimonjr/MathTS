/**
 * @danielsimonjr/mathts-functions
 *
 * Mathematical functions for MathTS - arithmetic, algebra,
 * trigonometry, statistics, and more.
 *
 * Uses typed-function for polymorphic dispatch across numeric types.
 *
 * @packageDocumentation
 */

// Typed functions (polymorphic via mathTyped)
export * from './typed/index.js';

// CAS functions — re-exported from the entry point rather than from
// `typed/index.js` so the module graph stays acyclic: `cas.ts` depends on the
// expression evaluator, which depends on the `typed/index.js` barrel.
export * from './typed/cas.js';

// Activated mathjs leaf factory functions
export * from './factories/index.js';

// Explicit re-export to resolve `to` / `toBest` ambiguity between the
// synced-mathjs factory layer (factories/index.js) and the new typed Unit
// implementation (typed/unit.js). The typed-dispatch version supersedes
// the factory version for the public barrel, mirroring how `cond` is
// resolved inside typed/index.js.
export { to, toBest } from './typed/unit.js';

// Expression evaluator (wired to full math scope)
export { evaluate, compileExpr, parse, parser, reviver, replacer } from './factories/evaluate.js';

// GC4 — mathjs canonical `help(search)` export (Help class + embedded docs).
export { help } from './help.js';
// Note: the rendering generators (toMathML/toHTML/…) live in and are imported
// directly from `@danielsimonjr/mathts-expression`; re-exporting them here broke
// cross-package type resolution (the package-name re-export poisoned this
// module's export list for consumers).
