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
  isComplex,
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

const RADIX_BITS: Record<string, number> = { b: 1, o: 3, x: 4 };
/** The largest magnitude of the binary exponent `p` in a radix string. */
const MAX_BINARY_EXPONENT = 100_000;

/**
 * Parse a BigNumber string. Beyond decimal text it reads the mathjs forms 0b / 0o / 0x, with an
 * optional fraction part and an optional binary exponent `p` (`0x1p3` is 8). The conversion is
 * exact, because the radix is a power of 2; the result then rounds to the configured precision.
 * It also reads the word-size suffix `0xFFi8` (two's complement, as mathjs). Departures from
 * mathjs 15.2.0: a sign applies after the word-size conversion (`-0xFFi8` is 1; mathjs drops the
 * sign and gives -1). The binary exponent must be in [-MAX_BINARY_EXPONENT, MAX_BINARY_EXPONENT].
 * The result rounds to the precision (mathjs keeps every digit of a radix string, and 20 digits
 * when the string has a binary exponent). `0x1i8p3` and `0xFFi8.0` throw (mathjs reads them).
 */
function parseBigNumberString(text: string): BigNumber {
  const m =
    /^([+-]?)0([bBoOxX])([0-9a-fA-F]*)(?:(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?|i(\d+))$/.exec(
      text
    );
  if (!m) return BigNumber.parse(text);
  const [, sign, radixChar, intDigits, fracDigits = '', expText, size] = m;
  const radix = radixChar.toLowerCase();
  const valid = { b: /^[01]*$/, o: /^[0-7]*$/, x: /^[0-9a-f]*$/i }[radix] as RegExp;
  const binaryExp = expText === undefined ? 0 : Number(expText);
  if (
    !valid.test(intDigits) ||
    !valid.test(fracDigits) ||
    (intDigits + fracDigits).length === 0 ||
    Math.abs(binaryExp) > MAX_BINARY_EXPONENT
  ) {
    throw new SyntaxError(`BigNumber cannot parse '${text}'`);
  }
  const prefix = `0${radix}`;
  let n = BigInt(prefix + (intDigits + fracDigits || '0'));
  if (size !== undefined) {
    // Two's complement in BigInt. 2^size is built only when size <= the bit length of n, so a
    // huge size such as 0xFFi999999999 costs nothing (n < 2^(size-1) gives n unchanged).
    const s = Number(size);
    const bitLength = n === 0n ? 0 : n.toString(2).length;
    if (s <= bitLength) {
      const twoPowSize = 1n << BigInt(s);
      if (n > twoPowSize - 1n) throw new SyntaxError(`String "${text}" is out of range`);
      if (s > 0 && n >= twoPowSize >> 1n) n -= twoPowSize;
    }
    return BigNumber.fromBigInt(sign === '-' ? -n : n).roundToPrecision(BigNumber.precision);
  }
  // value = n * 2^(binaryExp - bits * fracDigits) = n * 5^scale / 10^scale for scale >= 0
  const scale = RADIX_BITS[radix] * fracDigits.length - binaryExp;
  if (scale < 0) n <<= BigInt(-scale);
  else n *= 5n ** BigInt(scale);
  let digits = n.toString();
  if (scale > 0) {
    digits = digits.padStart(scale + 1, '0');
    digits = digits.slice(0, -scale) + '.' + digits.slice(-scale);
  }
  // rounded to the configured precision: 0x1p1000 has 302 digits, and 64 are significant
  const value = BigNumber.parse(digits).roundToPrecision(BigNumber.precision);
  return sign === '-' ? value.negate() : value;
}

/**
 * Convert a value to BigNumber, as mathjs `bignumber` does.
 * An Array or a Matrix converts element by element and keeps its shape and storage.
 * A Unit keeps its unit; the value of the Unit converts.
 * A Fraction converts as numerator / denominator at the BigNumber precision.
 * null converts to 0.
 */
function toBigNumber(x: unknown): unknown {
  // `isBigNumber` reads the brand, so a BigNumber of a second copy of core keeps its digits.
  if (isBigNumber(x)) return x;
  if (x === null) return BigNumber.fromNumber(0); // as mathjs; a Butcher tableau holds null
  if (typeof x === 'string') return parseBigNumberString(x);
  if (typeof x === 'number') return BigNumber.fromNumber(x);
  if (typeof x === 'bigint') return BigNumber.fromBigInt(x);
  if (Array.isArray(x)) return x.map(toBigNumber);
  if (isFraction(x)) {
    return BigNumber.fromFraction(x);
  }
  const o = (x ?? {}) as {
    isMatrix?: boolean;
    isUnit?: boolean;
    map(f: (v: unknown) => unknown): unknown;
    clone(): { value: unknown };
    value: unknown;
    valueOf(): unknown;
    isBigNumber?: boolean;
    isFraction?: boolean;
    s?: unknown;
    n?: unknown;
    d?: unknown;
  };
  if (o.isMatrix === true) return o.map(toBigNumber);
  if (o.isUnit === true) {
    const u = o.clone();
    u.value = toBigNumber(o.value);
    return u;
  }
  if (typeof x === 'boolean') return BigNumber.fromNumber(x ? 1 : 0);
  // A BigNumber or a Fraction of another library (decimal.js, fraction.js, mathjs) has the
  // marker but not the brand of core. The decimal text keeps every digit of the BigNumber.
  if (o.isBigNumber === true) return BigNumber.parse(String(x));
  if (o.isFraction === true) {
    const { s: sign, n, d } = o;
    if (typeof n === 'bigint' && typeof d === 'bigint') {
      return BigNumber.fromFraction({ numerator: (sign as bigint) < 0n ? -n : n, denominator: d });
    }
    return BigNumber.fromNumber(Number(o.valueOf()));
  }
  // As mathjs: Complex, a plain object and undefined have no BigNumber form.
  throw new TypeError(
    `Unexpected type of argument in function bignumber (expected: number or string or BigNumber or bigint or Fraction or Unit or null or boolean or Array or Matrix, actual: ${
      x === undefined ? 'undefined' : ((x as { type?: string }).type ?? typeof x)
    }, index: 0)`
  );
}

/**
 * True when the arguments have the shape that a collection gives to its callback:
 * `(value, index, collection)`. The index is a number (`Array.prototype.map`) or an array of
 * numbers (`map`, `forEach`, `filter` and the `map` method of a Matrix).
 */
function isCollectionCallbackCall(args: unknown[]): boolean {
  if (args.length !== 3) return false;
  const [, index, collection] = args;
  const indexOk =
    typeof index === 'number' ||
    (Array.isArray(index) && index.every((i) => typeof i === 'number'));
  return (
    indexOk &&
    (Array.isArray(collection) || (collection as { isMatrix?: boolean } | null)?.isMatrix === true)
  );
}

/**
 * `bignumber()` with no argument gives 0; `bignumber(undefined)` and a second argument throw, as in
 * mathjs. One exception keeps `bignumber` usable as a callback: the call shape
 * `(value, index, collection)` converts the value, so `map(x, bignumber)`, `forEach`, `filter`,
 * `matrix.map(bignumber)` and `[1, 2].map(bignumber)` work (mathjs throws for the last one only).
 */
function bignumberFn(...args: unknown[]): unknown {
  if (isCollectionCallbackCall(args)) return toBigNumber(args[0]);
  if (args.length > 1) {
    throw new TypeError(
      `Too many arguments in function bignumber (expected: 1, actual: ${args.length})`
    );
  }
  return args.length === 0 ? BigNumber.fromNumber(0) : toBigNumber(args[0]);
}

/**
 * complex() as in mathjs: no argument gives 0; a Complex is cloned; a number, BigNumber or
 * Fraction gives a real Complex; an object {re, im} or {r, phi} and a string are parsed;
 * (re, im) builds from two real parts; an Array or a Matrix maps each entry. A Complex entry keeps
 * its imaginary part, which the earlier two-argument constructor lost by nesting the entry in re
 * (#1220). A part that is not a real scalar and a third argument throw a TypeError, as in mathjs.
 * The call shape `(value, index, collection)` converts the value, as in `bignumber`.
 */
function complexFn(...args: unknown[]): unknown {
  const toNum = (x: unknown): number =>
    isBigNumber(x) ? x.toNumber() : isFraction(x) ? Number(x.valueOf()) : (x as number);
  const isRealPart = (x: unknown): boolean =>
    typeof x === 'number' || isBigNumber(x) || isFraction(x);
  if (isCollectionCallbackCall(args)) return complexFn(args[0]);
  if (args.length > 2) {
    throw new TypeError(
      `Too many arguments in function complex (expected: 2, actual: ${args.length})`
    );
  }
  if (args.length === 0 || args[0] === null) return new Complex(0, 0);
  const x = args[0];
  if (args.length === 2) {
    args.forEach((part, index) => {
      if (!isRealPart(part)) {
        throw new TypeError(
          'Unexpected type of argument in function complex (expected: number or BigNumber or ' +
            `Fraction, actual: ${(part as { type?: string } | null)?.type ?? typeof part}, index: ${index})`
        );
      }
    });
    return new Complex(toNum(x), toNum(args[1]));
  }
  if (isComplex(x)) return new Complex(x.re, x.im);
  if (typeof x === 'number') return new Complex(x, 0);
  if (isBigNumber(x) || isFraction(x)) return new Complex(toNum(x), 0);
  if (typeof x === 'string') return Complex.parse(x);
  if (Array.isArray(x)) return x.map((e) => complexFn(e));
  if (typeof x === 'object') {
    const o = x as Record<string, number> & { isMatrix?: boolean; map?: (f: unknown) => unknown };
    if (o.isMatrix === true && typeof o.map === 'function')
      return o.map((e: unknown) => complexFn(e));
    if ('re' in o && 'im' in o) return new Complex(toNum(o.re), toNum(o.im));
    const r = 'r' in o ? o.r : o.abs;
    const phi = 'phi' in o ? o.phi : o.arg;
    if (r !== undefined && phi !== undefined) return Complex.fromPolar(toNum(r), toNum(phi));
  }
  throw new Error('Expected object with properties (re and im) or (r and phi) or (abs and arg)');
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
  complex: complexFn,
  bignumber: bignumberFn,
  fraction: (n: number, d?: number) => new Fraction(n, d ?? 1),
  number: Number,

  // Matrix helper factories
  createDenseMatrix: (data: ConstructorParameters<typeof MathJSDenseMatrix>[0]) =>
    new MathJSDenseMatrix(data),
  createSparseMatrix: (data: ConstructorParameters<typeof MathJSSparseMatrix>[0]) =>
    new MathJSSparseMatrix(data),
};
