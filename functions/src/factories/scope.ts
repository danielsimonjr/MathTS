/**
 * Shared factory scope for activating synced mathjs factory functions.
 *
 * Provides all dependencies that leaf factories may request:
 * typed, config, Complex, BigNumber, Fraction, matrix bridge, and helper constructors.
 */

import { mathTyped, Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { initTypeBridge } from '../typed/typed-bridge.js';
import { DEFAULT_CONFIG } from '../core/config.js';
import { MathJSDenseMatrix, MathJSSparseMatrix, createMatrixBridge } from './matrix-bridge.js';

// Initialize type bridge so typed-function recognizes native types
initTypeBridge();

// Register extra types that mathjs factories reference in their typed() signatures
// but aren't in the default MathTS typed-function instance.
const typed = mathTyped as unknown as { addType(type: unknown, before: boolean): void };
const extraTypes = [
  // mathjs uses lowercase 'function' in signatures; typed-function registers 'Function'
  {
    name: 'function',
    test: (x: unknown): x is (...args: unknown[]) => unknown => typeof x === 'function',
  },
  // Expression node types — match objects with isNode flag and specific type properties
  {
    name: 'Node',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isNode === true,
  },
  {
    name: 'SymbolNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isSymbolNode === true,
  },
  {
    name: 'ConstantNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isConstantNode === true,
  },
  {
    name: 'OperatorNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isOperatorNode === true,
  },
  {
    name: 'FunctionNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isFunctionNode === true,
  },
  {
    name: 'ParenthesisNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>).isParenthesisNode === true,
  },
  {
    name: 'AccessorNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isAccessorNode === true,
  },
  {
    name: 'ArrayNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isArrayNode === true,
  },
  {
    name: 'AssignmentNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>).isAssignmentNode === true,
  },
  {
    name: 'BlockNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isBlockNode === true,
  },
  {
    name: 'ConditionalNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>).isConditionalNode === true,
  },
  {
    name: 'FunctionAssignmentNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>).isFunctionAssignmentNode === true,
  },
  {
    name: 'IndexNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isIndexNode === true,
  },
  {
    name: 'ObjectNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isObjectNode === true,
  },
  {
    name: 'RangeNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isRangeNode === true,
  },
  {
    name: 'RelationalNode',
    test: (x: unknown): x is object =>
      typeof x === 'object' &&
      x !== null &&
      (x as Record<string, unknown>).isRelationalNode === true,
  },
  // Index type — stub that matches objects with isIndex flag
  {
    name: 'Index',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isIndex === true,
  },
  // Range type — stub that matches objects with isRange flag
  {
    name: 'Range',
    test: (x: unknown): x is object =>
      typeof x === 'object' && x !== null && (x as Record<string, unknown>).isRange === true,
  },
  // Map type — needed by resolve() and other factories that accept scope maps
  { name: 'Map', test: (x: unknown): x is Map<string, unknown> => x instanceof Map },
  // Note: DenseMatrix, SparseMatrix, Matrix types are already registered by @danielsimonjr/mathts-core.
  // MathJSDenseMatrix passes their duck-type tests via .rows, .cols, .get, .type properties.
];

for (const t of extraTypes) {
  try {
    typed.addType(t, false);
  } catch {
    // Already registered — ignore
  }
}

/**
 * The scope object passed to each factory's assertAndCreate().
 * Keys match the dependency names factories declare.
 */
export const factoryScope: Record<string, unknown> = {
  typed: mathTyped,
  config: DEFAULT_CONFIG,

  // Class constructors (uppercase) — factories use `new BigNumber(...)` etc.
  Complex,
  BigNumber,
  Fraction,

  // Matrix bridge classes
  DenseMatrix: MathJSDenseMatrix,
  SparseMatrix: MathJSSparseMatrix,

  // Matrix factory function — creates MathJSDenseMatrix/MathJSSparseMatrix
  matrix: createMatrixBridge(),

  // Helper factory functions (lowercase) — factories call `complex(re, im)` etc.
  complex: (re: number, im: number) => new Complex(re, im),
  bignumber: (x: number | string | BigNumber | { valueOf(): number }) => {
    // Idempotent: a BigNumber passed back in must return unchanged. Previously this fell through
    // to `BigNumber.fromNumber(x)` with `x` an object, which `fromNumber` read as non-finite and
    // turned into `Infinity` — corrupting e.g. `quantileSeq(BigNumber[], …)` (which re-wraps its
    // BigNumber result) and Fraction→BigNumber conversions in the relational operators.
    if (x instanceof BigNumber) return x;
    if (typeof x === 'string') return BigNumber.parse(x);
    if (typeof x === 'number') return BigNumber.fromNumber(x);
    return BigNumber.fromNumber(Number(x.valueOf())); // Fraction / other numeric-like
  },
  fraction: (n: number, d?: number) => new Fraction(n, d ?? 1),
  number: Number,

  // Matrix helper factories
  createDenseMatrix: (data: ConstructorParameters<typeof MathJSDenseMatrix>[0]) =>
    new MathJSDenseMatrix(data),
  createSparseMatrix: (data: ConstructorParameters<typeof MathJSSparseMatrix>[0]) =>
    new MathJSSparseMatrix(data),
};
