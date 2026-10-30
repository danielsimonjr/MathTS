/**
 * Caps for untrusted expression text and hand-built trees.
 * Chosen by the measurement in expression/tests/security/limits.test.ts.
 * They are finite on purpose. ConfigOptions in core/src/config.ts is not extended.
 */
export const MAX_EXPRESSION_LENGTH = 1_000_000;

/** Largest parenthesis nesting `parse` accepts (see limits.test.ts). */
export const MAX_PARSE_NESTING = 125;

/** Deepest AST the tree-walking compiler accepts (see limits.test.ts). */
export const MAX_COMPILE_DEPTH = 512;
