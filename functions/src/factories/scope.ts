/**
 * Shared factory scope for activating owned mathjs-derived factory functions.
 *
 * Provides all dependencies that leaf factories may request:
 * typed, config, Complex, BigNumber, Fraction, matrix bridge, and helper constructors.
 */

import {
  mathTyped,
  Complex,
  Fraction,
  BigNumber,
  isBigNumber,
  isFraction,
} from '@danielsimonjr/mathts-core';
import { initTypeBridge } from '../typed/typed-bridge.js';
import { DEFAULT_CONFIG, type ConfigOptions } from '../core/config.js';
import { MathJSDenseMatrix, MathJSSparseMatrix, createMatrixBridge } from './matrix-bridge.js';
import { acceptsMatrix, adaptSparse } from './sparse-adapter.js';

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

/** Synchronous config overlay stack for {@link runWithConfig} (see config-api.ts). */
const configOverlayStack: ConfigOptions[] = [];

/**
 * Predicted-false on the barrel hot path (no overlay). Accessor getters
 * branch on this instead of walking a stack.
 */
let overlayActive = false;

function activeConfigSource(): ConfigOptions {
  return overlayActive ? configOverlayStack[configOverlayStack.length - 1]! : DEFAULT_CONFIG;
}

function writeConfigProp(source: object, prop: string | symbol, value: unknown): void {
  (source as unknown as Record<string | symbol, unknown>)[prop] = value;
}

function readLiveConfig(key: string | symbol): unknown {
  if (!overlayActive) {
    return (DEFAULT_CONFIG as unknown as Record<string | symbol, unknown>)[key];
  }
  const overlay = configOverlayStack[configOverlayStack.length - 1]!;
  if (Object.hasOwn(overlay, key)) {
    return (overlay as unknown as Record<string | symbol, unknown>)[key];
  }
  return (DEFAULT_CONFIG as unknown as Record<string | symbol, unknown>)[key];
}

/**
 * Push/pop helpers used by `runWithConfig` in config-api.ts.
 * @internal
 */
export function pushConfigOverlay(overlay: ConfigOptions): void {
  configOverlayStack.push(overlay);
  overlayActive = true;
}

/**
 * Pops the top config overlay and clears the active flag when the overlay stack becomes empty.
 * @internal
 */
export function popConfigOverlay(): void {
  configOverlayStack.pop();
  overlayActive = configOverlayStack.length > 0;
}

/**
 * Config object factories close over — reads/writes route through the active
 * overlay when `runWithConfig` has pushed one, else `DEFAULT_CONFIG`.
 *
 * Partial overlays merge with `DEFAULT_CONFIG`: a missing overlay key (e.g.
 * `runWithConfig({ number: 'Fraction' })` then `config.matrix`) falls back to
 * the process default. Nested `runWithConfig` calls replace the overlay; they
 * do not stack-merge keys with the parent overlay.
 *
 * Accessors (not a Proxy `get` trap) are the empty-stack hot path: wrapping
 * this object in a Proxy measured ~3× on `range()` even with no `get` trap.
 * Known-key assignment uses the setter and writes the active overlay.
 */
const configView = {} as ConfigOptions;
for (const key of Object.keys(DEFAULT_CONFIG) as (keyof ConfigOptions)[]) {
  Object.defineProperty(configView, key, {
    enumerable: true,
    configurable: true,
    get: () => readLiveConfig(key) as ConfigOptions[typeof key],
    set: (value: ConfigOptions[typeof key]) => {
      writeConfigProp(activeConfigSource(), key, value);
    },
  });
}

/**
 * The scope object passed to each factory's assertAndCreate().
 * Keys match the dependency names factories declare.
 */
/**
 * `typed` as the factories see it. Calling it builds the typed function as usual. A function
 * that declares a matrix type is wrapped once so that it accepts the public CSR
 * `SparseMatrix` (see sparse-adapter.ts); every other property reads through to `mathTyped`.
 */
const factoryTyped = new Proxy(mathTyped, {
  apply(target, thisArg, args: unknown[]) {
    const fn = Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args);
    if (typeof fn !== 'function' || !acceptsMatrix(fn)) return fn;
    const name =
      typeof args[0] === 'string' ? args[0] : (fn as { name?: string }).name || 'function';
    return adaptSparse(fn as (...a: never[]) => unknown, name);
  },
});

/**
 * Convert a value to BigNumber, as mathjs `bignumber` does.
 * An Array or a Matrix converts element by element and keeps its shape and storage.
 * A Unit keeps its unit; the value of the Unit converts.
 * A Fraction converts as numerator / denominator at the BigNumber precision.
 * null converts to 0.
 */
const RADIX_BITS: Record<string, number> = { b: 1, o: 3, x: 4 };

/**
 * Parse a BigNumber string. Beyond decimal text it reads the mathjs forms 0b / 0o / 0x (with an
 * optional fraction part, exact because the radix is a power of 2) and the word-size suffix
 * `0xFFi8` (two's complement, as mathjs).
 */
function parseBigNumberString(text: string): BigNumber {
  const m = /^\s*([+-]?)0([box])([0-9a-f]*)(?:\.([0-9a-f]*))?(?:i(\d+))?\s*$/i.exec(text);
  if (!m) return BigNumber.parse(text);
  const [, sign, radixChar, intDigits, fracDigits = '', size] = m;
  const radix = radixChar.toLowerCase();
  const valid = { b: /^[01]*$/, o: /^[0-7]*$/, x: /^[0-9a-f]*$/i }[radix] as RegExp;
  if (!valid.test(intDigits) || !valid.test(fracDigits) || (intDigits + fracDigits).length === 0) {
    throw new SyntaxError(`BigNumber cannot parse '${text}'`);
  }
  const bits = RADIX_BITS[radix];
  const prefix = `0${radix}`;
  const scale = bits * fracDigits.length;
  // value = N / 2^scale = N * 5^scale / 10^scale
  const n = BigInt(prefix + (intDigits + fracDigits || '0')) * 5n ** BigInt(scale);
  let digits = n.toString();
  if (scale > 0) {
    digits = digits.padStart(scale + 1, '0');
    digits = digits.slice(0, -scale) + '.' + digits.slice(-scale);
  }
  let value = BigNumber.parse(digits);
  if (size !== undefined) {
    const two = BigNumber.fromNumber(2);
    const twoPowSize = two.pow(Number(size));
    if (value.compareTo(twoPowSize.subtract(BigNumber.fromNumber(1))) > 0) {
      throw new SyntaxError(`String "${text.trim()}" is out of range`);
    }
    if (value.compareTo(two.pow(Number(size) - 1)) >= 0) value = value.subtract(twoPowSize);
  }
  return sign === '-' ? value.negate() : value;
}

function toBigNumber(x: unknown): unknown {
  // `isBigNumber` reads the brand, so a BigNumber of a second copy of core keeps its digits.
  if (isBigNumber(x)) return x;
  if (x === null) return BigNumber.fromNumber(0); // as mathjs; a Butcher tableau holds null
  if (typeof x === 'string') return parseBigNumberString(x);
  if (typeof x === 'number') return BigNumber.fromNumber(x);
  if (typeof x === 'bigint') return BigNumber.fromBigInt(x);
  if (Array.isArray(x)) return x.map(toBigNumber);
  if (isFraction(x)) {
    return BigNumber.fromBigInt(x.numerator).div(BigNumber.fromBigInt(x.denominator));
  }
  const o = (x ?? {}) as {
    isMatrix?: boolean;
    isUnit?: boolean;
    map(f: (v: unknown) => unknown): unknown;
    clone(): { value: unknown };
    value: unknown;
    valueOf(): unknown;
  };
  if (o.isMatrix === true) return o.map(toBigNumber);
  if (o.isUnit === true) {
    const u = o.clone();
    u.value = toBigNumber(o.value);
    return u;
  }
  if (typeof x === 'boolean') return BigNumber.fromNumber(x ? 1 : 0);
  // As mathjs: Complex, a plain object and undefined have no BigNumber form.
  throw new TypeError(
    `Unexpected type of argument in function bignumber (expected: number or string or BigNumber or bigint or Fraction or Unit or null or boolean or Array or Matrix, actual: ${
      x === undefined ? 'undefined' : ((x as { type?: string }).type ?? typeof x)
    }, index: 0)`
  );
}

/** `bignumber()` with no argument gives 0; `bignumber(undefined)` throws, as in mathjs. */
function bignumberFn(...args: unknown[]): unknown {
  return args.length === 0 ? BigNumber.fromNumber(0) : toBigNumber(args[0]);
}

export const factoryScope: Record<string, unknown> = {
  typed: factoryTyped,
  config: configView,

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
  bignumber: bignumberFn,
  fraction: (n: number, d?: number) => new Fraction(n, d ?? 1),
  number: Number,

  // Matrix helper factories
  createDenseMatrix: (data: ConstructorParameters<typeof MathJSDenseMatrix>[0]) =>
    new MathJSDenseMatrix(data),
  createSparseMatrix: (data: ConstructorParameters<typeof MathJSSparseMatrix>[0]) =>
    new MathJSSparseMatrix(data),
};
