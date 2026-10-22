/**
 * Batch evaluation of {@link ScalarNode} trees over `Float64Array` columns.
 *
 * {@link compileScalar} builds a register tape once; {@link CompiledScalar.evaluate}
 * runs every row with a per-row validity mask aligned with {@link evaluateScalar}.
 *
 * @packageDocumentation
 */

import type { LoweredScalarFn, ScalarNode, ScalarOperator } from '@danielsimonjr/mathts-expression';
import { ScalarEvalError } from './scalar-eval.js';

/** Decimal literal spellings — same as `NUMERIC_LITERAL` in `scalar-eval.ts`. */
const NUMERIC_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const UNARY_IMPL: Record<LoweredScalarFn, (value: number) => number> = {
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  abs: Math.abs,
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

function isScalarNode(value: unknown): value is ScalarNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'number' || kind === 'symbol' || kind === 'op' || kind === 'call';
}

function assertScalarNode(node: unknown): ScalarNode {
  if (!isScalarNode(node)) {
    const kind =
      node === null || Array.isArray(node) || typeof node !== 'object'
        ? undefined
        : (node as { kind?: unknown }).kind;
    throw new ScalarEvalError(`compileScalar: node kind '${String(kind)}' is not a ScalarNode`);
  }
  return node;
}

function assertNoDuplicateNames(names: readonly string[]): void {
  for (const name of names) {
    if (names.indexOf(name) !== names.lastIndexOf(name)) {
      throw new ScalarEvalError(`compileScalar: symbol '${name}' is listed more than once`);
    }
  }
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
  row: number
): { value: number; valid: boolean } {
  let valid = true;
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
        break;
      case 'mov':
        valid = storeChecked(scratch, instr.dest, scratch[instr.src], valid);
        break;
      case 'bin': {
        if (!valid) {
          scratch[instr.dest] = Number.NaN;
          break;
        }
        const left = scratch[instr.left];
        const right = scratch[instr.right];
        const result =
          instr.op === '^' ? Math.pow(left, right) : applyBinary(instr.op, left, right);
        valid = storeChecked(scratch, instr.dest, result, valid);
        break;
      }
      case 'unary': {
        if (!valid) {
          scratch[instr.dest] = Number.NaN;
          break;
        }
        const result = UNARY_IMPL[instr.fn](scratch[instr.arg]);
        valid = storeChecked(scratch, instr.dest, result, valid);
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
    throw new ScalarEvalError(`compileScalar: symbol '${name}' is listed more than once`);
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
      throw new ScalarEvalError(`compileScalar: constant '${name}' is not a number`);
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
    `evaluateScalar: symbol '${name}' has no value (not in scope, not a numeric literal).`
  );
}

function compileNode(ctx: CompileCtx, node: ScalarNode): number {
  const canonical = assertScalarNode(node);
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
      if (!Object.prototype.hasOwnProperty.call(UNARY_IMPL, canonical.fn)) {
        throw new ScalarEvalError(
          `evaluateScalar: unknown scalar function '${String(canonical.fn)}'.`
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
            `evaluateScalar: '^' needs exactly 2 args, got ${args.length}.`
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
 */
export function compileScalar(node: ScalarNode, options: CompileScalarOptions): CompiledScalar {
  const canonical = assertScalarNode(node);
  const variables = options.variables.slice();
  const parameters = (options.parameters ?? []).slice();
  const constants = options.constants ?? {};
  assertNoDuplicateNames(variables);
  assertNoDuplicateNames(parameters);

  const ctx: CompileCtx = {
    variables,
    parameters,
    constants,
    tape: [],
    nextReg: 0,
    rootReg: 0,
  };
  compileNode(ctx, canonical);
  const scratch = new Float64Array(ctx.nextReg);
  const tape = ctx.tape;
  const rootReg = ctx.rootReg;

  function checkParams(params: ArrayLike<number> | undefined): Float64Array | number[] {
    const nParams = parameters.length;
    if (params === undefined) {
      if (nParams > 0) {
        throw new ScalarEvalError(`compileScalar: expected ${nParams} parameters, got 0`);
      }
      return [];
    }
    if (params.length !== nParams) {
      throw new ScalarEvalError(
        `compileScalar: expected ${nParams} parameters, got ${params.length}`
      );
    }
    for (let i = 0; i < nParams; i++) {
      if (typeof params[i] !== 'number') {
        throw new ScalarEvalError(`compileScalar: parameter ${i} is not a number`);
      }
    }
    return params as number[];
  }

  function rowCount(columns: readonly Float64Array[]): number {
    const nVars = variables.length;
    if (columns.length !== nVars) {
      throw new ScalarEvalError(`compileScalar: expected ${nVars} columns, got ${columns.length}`);
    }
    for (let i = 0; i < columns.length; i++) {
      if (!isFloat64ArrayColumn(columns[i])) {
        throw new ScalarEvalError(`compileScalar: column ${i} must be a Float64Array`);
      }
    }
    if (nVars === 0) return 1;
    const n = columns[0]!.length;
    for (let i = 1; i < columns.length; i++) {
      if (columns[i]!.length !== n) {
        throw new ScalarEvalError('compileScalar: columns must have the same length');
      }
    }
    return n;
  }

  return {
    variables,
    parameters,
    evaluate(columns, params, out) {
      const n = rowCount(columns);
      const boundParams = checkParams(params);
      let values: Float64Array;
      if (out !== undefined) {
        if (out.length !== n) {
          throw new ScalarEvalError(
            `compileScalar: out length ${out.length} does not match row count ${n}`
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
          row
        );
        values[row] = rowValid ? value : Number.NaN;
        valid[row] = rowValid ? 1 : 0;
        if (!rowValid) allValid = false;
      }
      return { values, valid, allValid };
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
      const boundParams = checkParams(params);
      const columns: Float64Array[] = [];
      for (let i = 0; i < nVars; i++) {
        const col = new Float64Array(1);
        col[0] = row[i] as number;
        columns.push(col);
      }
      const { value, valid: rowValid } = runRow(tape, scratch, rootReg, columns, boundParams, 0);
      if (!rowValid) {
        throw new ScalarEvalError('compileScalar: row produced a non-finite value.');
      }
      return value;
    },
  };
}
