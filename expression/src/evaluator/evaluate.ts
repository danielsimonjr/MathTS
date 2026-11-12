/**
 * Expression evaluator for MathTS.
 *
 * Provides a high-level evaluate function that parses an expression string
 * and evaluates it against a math scope.
 *
 * @packageDocumentation
 */

import { compile } from '../compiler/compile.js';
import { MAX_COMPILE_DEPTH } from '../limits.js';
import { sanitizeEvaluateResult } from '../utils/safe-result.js';
import type { CompiledExpression, Scope } from '../compiler/compile.js';
import type { MathNode } from '../node/Node.js';

/**
 * Options accepted by evaluate / compileExpression.
 *
 * @property unsafe - When `true`, disables the pre-compile AST validator.
 *   The validator otherwise rejects assignments, function definitions, and
 *   calls to high-risk builtins (`import`, `createUnit`, `evaluate`, …).
 *   Only opt out when the host is providing trusted, hand-authored input.
 */
export interface EvaluateOptions {
  unsafe?: boolean;
}

/**
 * Names of forbidden top-level functions. Mirrors math-mcp's
 * `validateVariableName` blocklist plus the Mathjs RCE-vector functions
 * that build/eval other expressions at runtime.
 */
const FORBIDDEN_FUNCTIONS: ReadonlySet<string> = new Set([
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'typed',
  'simplify',
  'derivative',
  'help',
  'chain',
]);

/**
 * Walk an AST and throw on dangerous shapes.
 *
 * Default-safe rules:
 *   - AssignmentNode  → reject (mutating scope from an untrusted expression)
 *   - FunctionAssignmentNode → reject (`f(x) = …` lets payloads define captures)
 *   - FunctionNode whose name is in {@link FORBIDDEN_FUNCTIONS} → reject
 *
 * Caller can opt out with `{ unsafe: true }`.
 */
function validateAst(node: unknown, depth = 0): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  // The walk runs before compile, so it enforces the same depth cap: a left-deep chain such as
  // `1+1+...+1` is built iteratively by the parser and can be far deeper than compile accepts.
  if (depth >= MAX_COMPILE_DEPTH) {
    throw new Error(`expression exceeds compile depth ${MAX_COMPILE_DEPTH}`);
  }

  const n = node as Record<string, unknown>;

  // Hard rejections.
  if (n.isAssignmentNode === true) {
    throw new Error(
      'Security: assignment expressions are disabled. Pass `{ unsafe: true }` to opt out.'
    );
  }
  if (n.isFunctionAssignmentNode === true) {
    throw new Error(
      'Security: function definitions (FunctionAssignmentNode) are disabled. ' +
        'Pass `{ unsafe: true }` to opt out.'
    );
  }
  if (n.isFunctionNode === true) {
    const fn = n.fn as { isSymbolNode?: boolean; name?: unknown } | undefined;
    const fnName: string | undefined =
      (fn && typeof fn === 'object' && fn.isSymbolNode && typeof fn.name === 'string'
        ? fn.name
        : undefined) || (typeof n.name === 'string' ? n.name : undefined);
    if (fnName && FORBIDDEN_FUNCTIONS.has(fnName)) {
      throw new Error(
        `Security: call to forbidden function "${fnName}" is disabled. ` +
          'Pass `{ unsafe: true }` to opt out.'
      );
    }
  }

  // Recurse into children. Each AST node exposes `forEach`, but mock test
  // nodes don't, so fall back to walking known relational/structural fields.
  if (typeof n.forEach === 'function') {
    try {
      (n.forEach as (callback: (child: unknown) => void) => void)((child) =>
        validateAst(child, depth + 1)
      );
      return;
    } catch (err) {
      // Re-throw security and limit errors; absorb forEach incompatibilities. A RangeError must
      // not be absorbed: the fallback below re-walks the subtree, so every stack overflow at depth
      // d doubled the work and a 2,000-term sum ran for minutes.
      if (
        err instanceof RangeError ||
        (err instanceof Error &&
          (err.message.startsWith('Security:') || err.message.startsWith('expression exceeds')))
      ) {
        throw err;
      }
    }
  }

  // Manual recursion for plain mock nodes used in tests.
  for (const key of [
    'object',
    'index',
    'value',
    'expr',
    'condition',
    'trueExpr',
    'falseExpr',
    'content',
    'fn',
    'start',
    'end',
    'step',
  ]) {
    if (key in n) validateAst(n[key], depth + 1);
  }
  for (const key of ['args', 'items', 'params']) {
    const arr = n[key];
    if (Array.isArray(arr)) for (const child of arr) validateAst(child, depth + 1);
  }
  if (Array.isArray(n.blocks)) {
    for (const b of n.blocks) validateAst(b && (b as { node?: unknown }).node, depth + 1);
  }
  if (n.properties && typeof n.properties === 'object') {
    const properties = n.properties as Record<string, unknown>;
    for (const k of Object.keys(properties)) validateAst(properties[k], depth + 1);
  }
}

/** Maximum compiled expressions kept per (namespace, parser) pair. */
const COMPILE_CACHE_SIZE = 256;

type CompileCache = Map<string, CompiledExpression>;

/**
 * Compiled-expression caches, keyed by namespace identity and then parser
 * identity (so namespaces never share entries and are collectable). Entries are
 * created only after `validateAst` and `compile` both succeeded. Assumption:
 * a namespace is not mutated after expressions were compiled against it (the
 * compiler binds operator functions at compile time).
 */
const compileCaches = new WeakMap<object, WeakMap<object, CompileCache>>();

function cacheFor(mathScope: object, parseFn: object): CompileCache {
  let byParser = compileCaches.get(mathScope);
  if (!byParser) {
    byParser = new WeakMap();
    compileCaches.set(mathScope, byParser);
  }
  let cache = byParser.get(parseFn);
  if (!cache) {
    cache = new Map();
    byParser.set(parseFn, cache);
  }
  return cache;
}

/**
 * Create an evaluate function bound to a math scope and parse function.
 *
 * @param parseFn - The parse function (from createParse factory)
 * @param mathScope - Math namespace with functions and constants
 * @returns An evaluate function
 *
 * @example
 * ```ts
 * const mathScope = { add: (a, b) => a + b, pi: Math.PI, sin: Math.sin };
 * const evaluate = createEvaluate(parse, mathScope);
 * evaluate('2 + 3');         // 5
 * evaluate('sin(pi / 2)');   // 1
 * evaluate('x^2', { x: 3 }); // 9
 * ```
 */
export function createEvaluate(
  parseFn: (expr: string) => MathNode,
  mathScope: Record<string, unknown>,
  /**
   * Optional fingerprint of the state `parseFn` depends on besides the text
   * (for example the live `number` / `precision` config, which decides the
   * numeric type of literals at parse time). Called on every evaluate; its
   * value becomes part of the cache key, so a parse made under one config is
   * never reused under another. Omit when `parseFn` is a pure function of its
   * input.
   */
  cacheKey?: () => string
) {
  /**
   * Evaluate a math expression string.
   *
   * @param expr - Expression string to evaluate (e.g., '2 + 3', 'sin(pi/2)')
   * @param scope - Optional scope with variable bindings (e.g., { x: 3 })
   * @param options - Optional flags ({@link EvaluateOptions})
   * @returns The result of evaluating the expression
   */
  function evaluate(
    expr: string,
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown;
  /**
   * Evaluate multiple expression strings.
   *
   * @param exprs - Array of expression strings
   * @param scope - Optional scope with variable bindings
   * @param options - Optional flags
   * @returns Array of results
   */
  function evaluate(
    exprs: string[],
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown[];
  /**
   * Evaluates one expression string, or maps each string in an array, with the given scope and options.
   *
   * @param exprOrExprs - One expression string or an array of expression strings
   * @param scope - Optional scope with variable bindings
   * @param options - Optional flags
   * @returns One result, or an array of results
   */
  function evaluate(
    exprOrExprs: string | string[],
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown | unknown[] {
    if (Array.isArray(exprOrExprs)) {
      return exprOrExprs.map((expr) => evaluateOne(expr, scope, options));
    }
    return evaluateOne(exprOrExprs, scope, options);
  }

  const cache = cacheFor(mathScope, parseFn);

  function evaluateOne(
    expr: string,
    scope?: Record<string, unknown> | Scope,
    options?: EvaluateOptions
  ): unknown {
    const unsafe = options?.unsafe === true;
    // Safe and unsafe compiles of the same text are distinct entries.
    const key = (unsafe ? 'u:' : 's:') + (cacheKey ? cacheKey() + '\u0000' : '') + expr;
    let compiled = cache.get(key);
    if (compiled !== undefined) {
      // refresh recency (Map iterates in insertion order)
      cache.delete(key);
      cache.set(key, compiled);
    } else {
      const node = parseFn(expr);
      if (!unsafe) {
        validateAst(node);
      }
      compiled = compile(node, mathScope);
      cache.set(key, compiled);
      if (cache.size > COMPILE_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    }
    const result = compiled.evaluate(scope);
    return unsafe ? result : sanitizeEvaluateResult(result);
  }

  return evaluate;
}

/**
 * Compile an expression string into a reusable CompiledExpression.
 *
 * @param parseFn - The parse function
 * @param mathScope - Math namespace
 * @param expr - Expression string
 * @param options - Optional flags ({@link EvaluateOptions})
 * @returns CompiledExpression that can be evaluated multiple times with different scopes
 *
 * @example
 * ```ts
 * const compiled = compileExpression(parse, mathScope, 'x^2 + y');
 * compiled.evaluate({ x: 2, y: 1 }); // 5
 * compiled.evaluate({ x: 3, y: 2 }); // 11
 * ```
 */
/** Factory form: explicit parse function and math scope. */
export function compileExpressionWithDeps(
  parseFn: (expr: string) => MathNode,
  mathScope: Record<string, unknown>,
  expr: string,
  options?: EvaluateOptions
): CompiledExpression {
  const node = parseFn(expr);
  if (!options || options.unsafe !== true) {
    validateAst(node);
  }
  return compile(node, mathScope);
}
