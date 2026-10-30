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

/**
 * Re-entries of the parser's self-recursive rules (assignment, unary, and through them power and
 * the conditional branches) that one expression may nest. A parenthesis level costs two, so the
 * 125-level paren cap stays reachable (see limits.test.ts); a chain such as `-` x 20000, `1^1^...`,
 * `a=a=...` or `1?1:1?1:...` has no parenthesis to count and used to overflow the stack.
 */
export const MAX_PARSE_RECURSION = MAX_PARSE_NESTING * 4;
