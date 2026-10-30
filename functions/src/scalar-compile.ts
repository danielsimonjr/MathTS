/**
 * Batch evaluation of {@link ScalarNode} trees over `Float64Array` columns.
 *
 * {@link compileScalar} builds a register tape once; {@link CompiledScalar.evaluate}
 * runs every row with a per-row validity mask aligned with {@link evaluateScalar}.
 *
 * @packageDocumentation
 */

import { DUAL_UNARY_RULES, type DualUnaryRule } from '@danielsimonjr/mathts-core';
import type { LoweredScalarFn, ScalarNode, ScalarOperator } from '@danielsimonjr/mathts-expression';
import { NUMERIC_LITERAL, ScalarEvalError } from './scalar-eval.js';

const LOWERED_UNARY_RULES: Record<LoweredScalarFn, DualUnaryRule> = {
  exp: DUAL_UNARY_RULES.exp,
  log: DUAL_UNARY_RULES.log,
  log10: DUAL_UNARY_RULES.log10,
  log2: DUAL_UNARY_RULES.log2,
  sin: DUAL_UNARY_RULES.sin,
  cos: DUAL_UNARY_RULES.cos,
  tan: DUAL_UNARY_RULES.tan,
  sinh: DUAL_UNARY_RULES.sinh,
  cosh: DUAL_UNARY_RULES.cosh,
  tanh: DUAL_UNARY_RULES.tanh,
  abs: DUAL_UNARY_RULES.abs,
};

type TapeInstr =
  | { readonly tag: 'const'; readonly dest: number; readonly value: number }
  | { readonly tag: 'column'; readonly dest: number; readonly index: number }
  | { readonly tag: 'param'; readonly dest: number; readonly index: number }
  | { readonly tag: 'mov'; readonly dest: number; readonly src: number }
  | {
      readonly tag: 'bin';
      readonly dest: number;
      readonly op: ScalarOperator;
      readonly left: number;
      readonly right: number;
    }
  | {
      readonly tag: 'unary';
      readonly dest: number;
      readonly fn: LoweredScalarFn;
      readonly arg: number;
    };

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
 *
 * @example
 * ```ts
 * import { compileScalar, scalar } from '@danielsimonjr/mathts-functions';
 * const node = scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]);
 * compileScalar(node, { variables: ['x'], parameters: ['a'] }).parameters; // ['a']
 * ```
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
 *
 * @example
 * ```ts
 * import { compileScalar, scalar } from '@danielsimonjr/mathts-functions';
 * const compiled = compileScalar(scalar.call('ln', scalar.symbol('x')), { variables: ['x'] });
 * const { values, valid } = compiled.evaluate([new Float64Array([1, -1])]);
 * [...valid]; // [1, 0]
 * values[1]; // NaN
 * ```
 */
export interface ScalarBatchResult {
  readonly values: Float64Array;
  readonly valid: Uint8Array;
  readonly allValid: boolean;
}

/**
 * A compiled scalar. `variables` and `parameters` are copies made at compile time.
 *
 * @example
 * ```ts
 * import { compileScalar, scalar } from '@danielsimonjr/mathts-functions';
 * const compiled = compileScalar(
 *   scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]),
 *   { variables: ['x'] }
 * );
 * [...compiled.evaluate([new Float64Array([2, 3])]).values]; // [4, 9]
 * compiled.evaluateRow([2]); // 4
 * ```
 */
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
   *
   * @example
   * ```ts
   * import { compileScalar, scalar } from '@danielsimonjr/mathts-functions';
   * const compiled = compileScalar(
   *   scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]),
   *   { variables: ['x'] }
   * );
   * [...compiled.evaluate([new Float64Array([2, 3])]).values].join(','); // '4,9'
   * ```
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
   *
   * @example
   * ```ts
   * import { compileScalar, scalar, ScalarEvalError } from '@danielsimonjr/mathts-functions';
   * const compiled = compileScalar(scalar.call('ln', scalar.symbol('x')), { variables: ['x'] });
   * try {
   *   compiled.evaluateRow([-1]);
   * } catch (e) {
   *   e instanceof ScalarEvalError; // true — 'compileScalar: row produced a non-finite value.'
   * }
   * ```
   */
  evaluateRow(row: ArrayLike<number>, params?: ArrayLike<number>): number;
}

/**
 * Batch primal values and exact parameter gradients of a compiled scalar.
 * `grad[r * nParams + p]` is ∂f/∂`parameters[p]` at row `r`. Uses the same
 * register tape as {@link compileScalar} with one forward lane per parameter.
 *
 * @example
 * ```ts
 * import { compileScalarGradient, scalar } from '@danielsimonjr/mathts-functions';
 * const node = scalar.op('+', [
 *   scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
 *   scalar.symbol('b'),
 * ]);
 * const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
 * const { values, grad } = g.evaluate([new Float64Array([3])], [2, -1]);
 * values[0]; // 5
 * [...grad]; // 3, 1 — ∂/∂a = x, ∂/∂b = 1
 * ```
 */
export interface CompiledScalarGradient {
  readonly variables: readonly string[];
  readonly parameters: readonly string[];
  /**
   * Evaluate every row. Invalid rows store `NaN` in `values` and every
   * gradient entry for that row. The mask matches {@link compileScalar} except
   * when a consumed `^` partial is not finite (a live child lane of `0^0`, or
   * `ln` of a negative base with a live exponent): those rows are extra-invalid.
   * Throws {@link ScalarEvalError} for binding mismatches or bad `out` lengths.
   *
   * @example
   * ```ts
   * import { compileScalarGradient, scalar } from '@danielsimonjr/mathts-functions';
   * const node = scalar.op('+', [
   *   scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
   *   scalar.symbol('b'),
   * ]);
   * const compiled = compileScalarGradient(node, {
   *   variables: ['x'],
   *   parameters: ['a', 'b'],
   * });
   * const outV = new Float64Array(1);
   * const outG = new Float64Array(2);
   * compiled.evaluate([new Float64Array([3])], [2, -1], { values: outV, grad: outG });
   * outV[0]; // 5
   * [...outG]; // 3, 1
   * ```
   */
  evaluate(
    columns: readonly Float64Array[],
    params: ArrayLike<number>,
    out?: { values?: Float64Array; grad?: Float64Array }
  ): ScalarBatchResult & { readonly grad: Float64Array };
}

function isScalarNode(value: unknown): value is ScalarNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'number' || kind === 'symbol' || kind === 'op' || kind === 'call';
}

function assertScalarNode(node: unknown, messagePrefix: string): ScalarNode {
  if (!isScalarNode(node)) {
    const kind =
      node === null || Array.isArray(node) || typeof node !== 'object'
        ? undefined
        : (node as { kind?: unknown }).kind;
    throw new ScalarEvalError(`${messagePrefix} node kind '${String(kind)}' is not a ScalarNode`);
  }
  return node;
}

function assertNoDuplicateNames(names: readonly string[], messagePrefix: string): void {
  for (const name of names) {
    if (names.indexOf(name) !== names.lastIndexOf(name)) {
      throw new ScalarEvalError(`${messagePrefix} symbol '${name}' is listed more than once`);
    }
  }
}

/**
 * M3 kept `evaluateScalar:` on unbound-symbol / unknown-fn / `^` arity so
 * `scalar-compile.test.ts` continues to match those strings. Gradient compile
 * uses `compileScalarGradient:` for the same conditions.
 */
function evalStylePrefix(messagePrefix: string): string {
  return messagePrefix === 'compileScalar:' ? 'evaluateScalar:' : messagePrefix;
}

function copyRegisterGrad(
  grad: Float64Array,
  srcReg: number,
  destReg: number,
  nParams: number
): void {
  const srcBase = srcReg * nParams;
  const destBase = destReg * nParams;
  for (let p = 0; p < nParams; p++) {
    grad[destBase + p] = grad[srcBase + p];
  }
}

function setRegisterGradNaN(grad: Float64Array, reg: number, nParams: number): void {
  const base = reg * nParams;
  for (let p = 0; p < nParams; p++) {
    grad[base + p] = Number.NaN;
  }
}

/** ∂/∂base for `base^exp` when the base lane is live. */
function powBasePartial(exp: number, base: number): number {
  return exp * Math.pow(base, exp - 1);
}

/** ∂/∂exp for `base^exp` when the exponent lane is live (`value` is `Math.pow(base, exp)`). */
function powExpPartial(value: number, base: number): number {
  return value * Math.log(base);
}

function isFloat64ArrayColumn(col: unknown): col is Float64Array {
  if (col instanceof Float64Array) return true;
  return ArrayBuffer.isView(col) && (col as Float64Array).constructor.name === 'Float64Array';
}

function applyBinary(op: Exclude<ScalarOperator, '^'>, left: number, right: number): number {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
  }
}

/**
 * `requireFinite` from `scalar-eval.ts`: a still-valid row that is not a
 * finite number becomes invalid and stores `NaN`. Used after every binary,
 * unary call, and one-argument `+ - * /` (`evalOp` always ends with
 * `return requireFinite(acc, op)`, which is the n=1 path).
 */
function storeChecked(
  scratch: Float64Array,
  dest: number,
  result: number,
  valid: boolean
): boolean {
  if (!valid || typeof result !== 'number' || !Number.isFinite(result)) {
    scratch[dest] = Number.NaN;
    return false;
  }
  scratch[dest] = result;
  return true;
}

function runRow(
  tape: readonly TapeInstr[],
  scratch: Float64Array,
  rootReg: number,
  columns: readonly Float64Array[],
  params: ArrayLike<number>,
  row: number,
  grad: Float64Array | undefined,
  nParams: number
): { value: number; valid: boolean } {
  let valid = true;
  if (grad !== undefined && nParams > 0) {
    grad.fill(0);
  }
  for (const instr of tape) {
    switch (instr.tag) {
      case 'const':
        scratch[instr.dest] = instr.value;
        break;
      case 'column':
        scratch[instr.dest] = columns[instr.index][row];
        break;
      case 'param':
        scratch[instr.dest] = params[instr.index] as number;
        if (grad !== undefined && nParams > 0) {
          const destBase = instr.dest * nParams;
          for (let p = 0; p < nParams; p++) {
            grad[destBase + p] = p === instr.index ? 1 : 0;
          }
        }
        break;
      case 'mov':
        if (!valid) {
          scratch[instr.dest] = Number.NaN;
          if (grad !== undefined && nParams > 0) {
            setRegisterGradNaN(grad, instr.dest, nParams);
          }
          break;
        }
        valid = storeChecked(scratch, instr.dest, scratch[instr.src], valid);
        if (grad !== undefined && nParams > 0) {
          if (valid) {
            copyRegisterGrad(grad, instr.src, instr.dest, nParams);
          } else {
            setRegisterGradNaN(grad, instr.dest, nParams);
          }
        }
        break;
      case 'bin': {
        if (!valid) {
          scratch[instr.dest] = Number.NaN;
          if (grad !== undefined && nParams > 0) {
            setRegisterGradNaN(grad, instr.dest, nParams);
          }
          break;
        }
        const left = scratch[instr.left];
        const right = scratch[instr.right];
        const result =
          instr.op === '^' ? Math.pow(left, right) : applyBinary(instr.op, left, right);
        valid = storeChecked(scratch, instr.dest, result, valid);
        if (grad !== undefined && nParams > 0) {
          if (!valid) {
            setRegisterGradNaN(grad, instr.dest, nParams);
            break;
          }
          const destBase = instr.dest * nParams;
          const leftBase = instr.left * nParams;
          const rightBase = instr.right * nParams;
          if (instr.op === '^') {
            const base = left;
            const exp = right;
            const val = scratch[instr.dest];
            for (let p = 0; p < nParams; p++) {
              let g = 0;
              const dl = grad[leftBase + p];
              const dr = grad[rightBase + p];
              if (dl !== 0) {
                const factor = powBasePartial(exp, base);
                if (!Number.isFinite(factor)) {
                  valid = false;
                  scratch[instr.dest] = Number.NaN;
                  setRegisterGradNaN(grad, instr.dest, nParams);
                  break;
                }
                g += dl * factor;
              }
              if (dr !== 0) {
                const factor = powExpPartial(val, base);
                if (!Number.isFinite(factor)) {
                  valid = false;
                  scratch[instr.dest] = Number.NaN;
                  setRegisterGradNaN(grad, instr.dest, nParams);
                  break;
                }
                g += dr * factor;
              }
              grad[destBase + p] = g;
            }
          } else {
            for (let p = 0; p < nParams; p++) {
              const gl = grad[leftBase + p];
              const gr = grad[rightBase + p];
              switch (instr.op) {
                case '+':
                  grad[destBase + p] = gl + gr;
                  break;
                case '-':
                  grad[destBase + p] = gl - gr;
                  break;
                case '*':
                  grad[destBase + p] = gl * right + left * gr;
                  break;
                case '/': {
                  const denom = right * right;
                  grad[destBase + p] = (gl * right - left * gr) / denom;
                  break;
                }
              }
            }
          }
        }
        break;
      }
      case 'unary': {
        if (!valid) {
          scratch[instr.dest] = Number.NaN;
          if (grad !== undefined && nParams > 0) {
            setRegisterGradNaN(grad, instr.dest, nParams);
          }
          break;
        }
        const x = scratch[instr.arg];
        const rule = LOWERED_UNARY_RULES[instr.fn];
        const result = rule.primal(x);
        valid = storeChecked(scratch, instr.dest, result, valid);
        if (grad !== undefined && nParams > 0) {
          if (!valid) {
            setRegisterGradNaN(grad, instr.dest, nParams);
            break;
          }
          const destBase = instr.dest * nParams;
          const argBase = instr.arg * nParams;
          const y = scratch[instr.dest];
          for (let p = 0; p < nParams; p++) {
            const al = grad[argBase + p];
            if (al === 0) {
              grad[destBase + p] = 0;
              continue;
            }
            const d = rule.deriv(x, y);
            if (!Number.isFinite(d)) {
              valid = false;
              scratch[instr.dest] = Number.NaN;
              setRegisterGradNaN(grad, instr.dest, nParams);
              break;
            }
            grad[destBase + p] = al * d;
          }
        }
        break;
      }
    }
  }
  return { value: scratch[rootReg], valid };
}

interface CompileCtx {
  readonly variables: readonly string[];
  readonly parameters: readonly string[];
  readonly constants: Readonly<Record<string, number>>;
  readonly messagePrefix: string;
  readonly tape: TapeInstr[];
  nextReg: number;
  rootReg: number;
}

function allocReg(ctx: CompileCtx): number {
  return ctx.nextReg++;
}

function bindSymbol(ctx: CompileCtx, name: string, dest: number): void {
  const inVars = ctx.variables.indexOf(name);
  const inParams = ctx.parameters.indexOf(name);
  const inConsts = Object.prototype.hasOwnProperty.call(ctx.constants, name);
  const hits = (inVars >= 0 ? 1 : 0) + (inParams >= 0 ? 1 : 0) + (inConsts ? 1 : 0);
  if (hits >= 2) {
    throw new ScalarEvalError(`${ctx.messagePrefix} symbol '${name}' is listed more than once`);
  }
  if (inParams >= 0) {
    ctx.tape.push({ tag: 'param', dest, index: inParams });
    return;
  }
  if (inVars >= 0) {
    ctx.tape.push({ tag: 'column', dest, index: inVars });
    return;
  }
  if (inConsts) {
    const value = ctx.constants[name];
    if (typeof value !== 'number') {
      throw new ScalarEvalError(`${ctx.messagePrefix} constant '${name}' is not a number`);
    }
    ctx.tape.push({ tag: 'const', dest, value });
    return;
  }
  if (NUMERIC_LITERAL.test(name)) {
    const literal = Number(name);
    if (Number.isFinite(literal)) {
      ctx.tape.push({ tag: 'const', dest, value: literal });
      return;
    }
  }
  throw new ScalarEvalError(
    `${evalStylePrefix(ctx.messagePrefix)} symbol '${name}' has no value (not in scope, not a numeric literal).`
  );
}

function compileNode(ctx: CompileCtx, node: ScalarNode): number {
  const canonical = assertScalarNode(node, ctx.messagePrefix);
  const dest = allocReg(ctx);
  switch (canonical.kind) {
    case 'number':
      ctx.tape.push({ tag: 'const', dest, value: canonical.value });
      ctx.rootReg = dest;
      return dest;
    case 'symbol':
      bindSymbol(ctx, canonical.name, dest);
      ctx.rootReg = dest;
      return dest;
    case 'call': {
      if (!Object.prototype.hasOwnProperty.call(LOWERED_UNARY_RULES, canonical.fn)) {
        throw new ScalarEvalError(
          `${evalStylePrefix(ctx.messagePrefix)} unknown scalar function '${String(canonical.fn)}'.`
        );
      }
      const argReg = compileNode(ctx, canonical.arg);
      ctx.tape.push({ tag: 'unary', dest, fn: canonical.fn, arg: argReg });
      ctx.rootReg = dest;
      return dest;
    }
    case 'op': {
      const { op, args } = canonical;
      if (op === '^') {
        if (args.length !== 2) {
          throw new ScalarEvalError(
            `${evalStylePrefix(ctx.messagePrefix)} '^' needs exactly 2 args, got ${args.length}.`
          );
        }
        const left = compileNode(ctx, args[0]);
        const right = compileNode(ctx, args[1]);
        ctx.tape.push({ tag: 'bin', dest, op: '^', left, right });
        ctx.rootReg = dest;
        return dest;
      }
      if (args.length === 0) {
        const value = op === '*' || op === '/' ? 1 : 0;
        ctx.tape.push({ tag: 'const', dest, value });
        ctx.rootReg = dest;
        return dest;
      }
      if (args.length === 1) {
        const src = compileNode(ctx, args[0]);
        if (src !== dest) {
          ctx.tape.push({ tag: 'mov', dest, src });
        }
        ctx.rootReg = dest;
        return dest;
      }
      let acc = compileNode(ctx, args[0]);
      for (let i = 1; i < args.length; i++) {
        const right = compileNode(ctx, args[i]);
        const stepDest = i === args.length - 1 ? dest : acc;
        ctx.tape.push({ tag: 'bin', dest: stepDest, op, left: acc, right });
        acc = stepDest;
      }
      ctx.rootReg = dest;
      return dest;
    }
  }
}

/**
 * Compile `node` once. Unknown symbols and a `^` that does not have two
 * arguments throw {@link ScalarEvalError} here, not per row.
 * The compiled object is synchronous and not reentrant: one `evaluate` must
 * finish before the next starts on that object (the scratch tape is reused).
 *
 * @example
 * ```ts
 * import { compileScalar, scalar } from '@danielsimonjr/mathts-functions';
 * const node = scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]);
 * const compiled = compileScalar(node, { variables: ['x'] });
 * [...compiled.evaluate([new Float64Array([2, 3])]).values]; // [4, 9]
 * ```
 */
function checkCompileParams(
  params: ArrayLike<number> | undefined,
  parameters: readonly string[],
  messagePrefix: string
): number[] {
  const nParams = parameters.length;
  if (params === undefined) {
    if (nParams > 0) {
      throw new ScalarEvalError(`${messagePrefix} expected ${nParams} parameters, got 0`);
    }
    return [];
  }
  if (params.length !== nParams) {
    throw new ScalarEvalError(
      `${messagePrefix} expected ${nParams} parameters, got ${params.length}`
    );
  }
  for (let i = 0; i < nParams; i++) {
    if (typeof params[i] !== 'number') {
      throw new ScalarEvalError(`${messagePrefix} parameter ${i} is not a number`);
    }
  }
  return params as number[];
}

function compileRowCount(
  columns: readonly Float64Array[],
  variables: readonly string[],
  messagePrefix: string
): number {
  const nVars = variables.length;
  if (columns.length !== nVars) {
    throw new ScalarEvalError(`${messagePrefix} expected ${nVars} columns, got ${columns.length}`);
  }
  for (let i = 0; i < columns.length; i++) {
    if (!isFloat64ArrayColumn(columns[i])) {
      throw new ScalarEvalError(`${messagePrefix} column ${i} must be a Float64Array`);
    }
  }
  if (nVars === 0) return 1;
  const n = columns[0]!.length;
  for (let i = 1; i < columns.length; i++) {
    if (columns[i]!.length !== n) {
      throw new ScalarEvalError(`${messagePrefix} columns must have the same length`);
    }
  }
  return n;
}

/**
 * Run a compiled register tape over every row. Shared by {@link compileScalar} and the
 * scalar batch worker (M14); not re-exported from the package barrel.
 */
export function evaluateScalarTape(
  tape: readonly TapeInstr[],
  rootReg: number,
  nRegs: number,
  columns: readonly Float64Array[],
  variables: readonly string[],
  params: ArrayLike<number>,
  parameters: readonly string[],
  messagePrefix: string,
  out?: Float64Array
): ScalarBatchResult {
  const n = compileRowCount(columns, variables, messagePrefix);
  const boundParams = checkCompileParams(params, parameters, messagePrefix);
  const scratch = new Float64Array(nRegs);
  let values: Float64Array;
  if (out !== undefined) {
    if (out.length !== n) {
      throw new ScalarEvalError(
        `${messagePrefix} out length ${out.length} does not match row count ${n}`
      );
    }
    values = out;
  } else {
    values = new Float64Array(n);
  }
  const valid = new Uint8Array(n);
  let allValid = true;
  for (let row = 0; row < n; row++) {
    const { value, valid: rowValid } = runRow(
      tape,
      scratch,
      rootReg,
      columns,
      boundParams,
      row,
      undefined,
      0
    );
    values[row] = rowValid ? value : Number.NaN;
    valid[row] = rowValid ? 1 : 0;
    if (!rowValid) allValid = false;
  }
  return { values, valid, allValid };
}

export function buildTape(
  node: ScalarNode,
  options: CompileScalarOptions,
  messagePrefix: string
): {
  tape: readonly TapeInstr[];
  rootReg: number;
  nRegs: number;
  variables: string[];
  parameters: string[];
} {
  const canonical = assertScalarNode(node, messagePrefix);
  const variables = options.variables.slice();
  const parameters = (options.parameters ?? []).slice();
  const constants = options.constants ?? {};
  assertNoDuplicateNames(variables, messagePrefix);
  assertNoDuplicateNames(parameters, messagePrefix);
  const ctx: CompileCtx = {
    variables,
    parameters,
    constants,
    messagePrefix,
    tape: [],
    nextReg: 0,
    rootReg: 0,
  };
  compileNode(ctx, canonical);
  return {
    tape: ctx.tape,
    rootReg: ctx.rootReg,
    nRegs: ctx.nextReg,
    variables,
    parameters,
  };
}

export function compileScalar(node: ScalarNode, options: CompileScalarOptions): CompiledScalar {
  const messagePrefix = 'compileScalar:';
  const { tape, rootReg, nRegs, variables, parameters } = buildTape(node, options, messagePrefix);
  const scratch = new Float64Array(nRegs);

  return {
    variables,
    parameters,
    evaluate(columns, params, out) {
      return evaluateScalarTape(
        tape,
        rootReg,
        nRegs,
        columns,
        variables,
        params ?? [],
        parameters,
        messagePrefix,
        out
      );
    },
    evaluateRow(row, params) {
      const nVars = variables.length;
      if (row.length !== nVars) {
        throw new ScalarEvalError(
          `compileScalar: expected ${nVars} row entries, got ${row.length}`
        );
      }
      for (let i = 0; i < nVars; i++) {
        if (typeof row[i] !== 'number') {
          throw new ScalarEvalError(`compileScalar: row entry ${i} is not a number`);
        }
      }
      const boundParams = checkCompileParams(params, parameters, messagePrefix);
      const columns: Float64Array[] = [];
      for (let i = 0; i < nVars; i++) {
        const col = new Float64Array(1);
        col[0] = row[i] as number;
        columns.push(col);
      }
      const { value, valid: rowValid } = runRow(
        tape,
        scratch,
        rootReg,
        columns,
        boundParams,
        0,
        undefined,
        0
      );
      if (!rowValid) {
        throw new ScalarEvalError('compileScalar: row produced a non-finite value.');
      }
      return value;
    },
  };
}

/**
 * Compile `node` once for batch primal values and exact parameter gradients.
 * Shares the M3 register tape; adds one forward lane per parameter via
 * {@link DUAL_UNARY_RULES} and explicit `^` partials. Not reentrant.
 *
 * @example
 * ```ts
 * import { compileScalarGradient, scalar } from '@danielsimonjr/mathts-functions';
 * const node = scalar.op('+', [
 *   scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
 *   scalar.symbol('b'),
 * ]);
 * const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
 * const { values, grad } = g.evaluate([new Float64Array([3])], [2, -1]);
 * values[0]; // 5
 * [...grad]; // 3, 1
 * ```
 */
export function compileScalarGradient(
  node: ScalarNode,
  options: CompileScalarOptions
): CompiledScalarGradient {
  const messagePrefix = 'compileScalarGradient:';
  const { tape, rootReg, nRegs, variables, parameters } = buildTape(node, options, messagePrefix);
  const scratch = new Float64Array(nRegs);
  const nParams = parameters.length;
  const gradScratch = nParams > 0 ? new Float64Array(nRegs * nParams) : new Float64Array(0);

  return {
    variables,
    parameters,
    evaluate(columns, params, out) {
      const n = compileRowCount(columns, variables, messagePrefix);
      const boundParams = checkCompileParams(params, parameters, messagePrefix);
      let values: Float64Array;
      if (out?.values !== undefined) {
        if (out.values.length !== n) {
          throw new ScalarEvalError(
            `${messagePrefix} out values length ${out.values.length} does not match row count ${n}`
          );
        }
        values = out.values;
      } else {
        values = new Float64Array(n);
      }
      let grad: Float64Array;
      const gradLen = n * nParams;
      if (out?.grad !== undefined) {
        if (out.grad.length !== gradLen) {
          throw new ScalarEvalError(
            `${messagePrefix} out grad length ${out.grad.length} does not match ${gradLen}`
          );
        }
        grad = out.grad;
      } else {
        grad = new Float64Array(gradLen);
      }
      const valid = new Uint8Array(n);
      let allValid = true;
      const rootBase = rootReg * nParams;
      for (let row = 0; row < n; row++) {
        const { value, valid: rowValid } = runRow(
          tape,
          scratch,
          rootReg,
          columns,
          boundParams,
          row,
          nParams > 0 ? gradScratch : undefined,
          nParams
        );
        values[row] = rowValid ? value : Number.NaN;
        valid[row] = rowValid ? 1 : 0;
        const gradRow = row * nParams;
        if (rowValid && nParams > 0) {
          for (let p = 0; p < nParams; p++) {
            grad[gradRow + p] = gradScratch[rootBase + p];
          }
        } else if (nParams > 0) {
          for (let p = 0; p < nParams; p++) {
            grad[gradRow + p] = Number.NaN;
          }
        }
        if (!rowValid) allValid = false;
      }
      return { values, valid, allValid, grad };
    },
  };
}
