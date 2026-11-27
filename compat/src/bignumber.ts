import {
  BigNumber as NativeBigNumber,
  Complex,
  isBigNumber,
  isComplex,
  isFraction,
  isUnit,
} from '@danielsimonjr/mathts-core';
import { toCompatComplex } from './mathjs-complex-prototype.js';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';

/** decimal.js (and mathjs) use exponent `0`, never `-0`, in deep equality tests. */
function fixNegativeZeroExponent(bn: CompatBigNumber): CompatBigNumber {
  const exponent = (bn as unknown as { _exponent: number })._exponent;
  if (Object.is(exponent, -0)) {
    const Ctor = bn.constructor as typeof CompatBigNumber;
    return new Ctor(bn.toString());
  }
  return bn;
}

/** A MathTS decimal with the default string notation used by mathjs. */
class CompatBigNumber extends NativeBigNumber {
  override toString(): string {
    return this.e <= -7 || this.e >= 21 ? this.toExponential() : this.toFixed();
  }

  /** Keep every decimal digit when JavaScript coerces the value to text. */
  [Symbol.toPrimitive](hint: string): number | string {
    return hint === 'number' ? this.toNumber() : this.toString();
  }

  static override fromJSON(json: { value: string }): CompatBigNumber {
    return new CompatBigNumber(json.value);
  }
}

function isBridgeMatrix(value: object): value is {
  isMatrix?: boolean;
  map: (callback: (entry: unknown) => unknown) => unknown;
  forEach?: (callback: (entry: unknown) => void) => void;
} {
  const candidate = value as { isMatrix?: boolean; map?: unknown; forEach?: unknown };
  return candidate.isMatrix === true && typeof candidate.map === 'function';
}

function isExpressionNode(value: object): value is {
  isNode: boolean;
  evaluate: (...args: unknown[]) => unknown;
} {
  const candidate = value as { isNode?: boolean; evaluate?: unknown };
  return candidate.isNode === true && typeof candidate.evaluate === 'function';
}

const nodeEvaluateWrapped = Symbol('compatNodeEvaluateWrapped');

/** When one operand is a BigNumber, mathjs promotes booleans to 0/1 BigNumbers. */
export function promoteBooleanScalarsForBigNumber(
  args: unknown[],
  BigNumberCtor: typeof CompatBigNumber,
  options?: { promoteTrailingBoolean?: boolean }
): unknown[] {
  let hasBigNumber = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (
      a instanceof BigNumberCtor ||
      a instanceof CompatBigNumber ||
      (a instanceof NativeBigNumber && isBigNumber(a))
    ) {
      hasBigNumber = true;
      break;
    }
  }
  if (!hasBigNumber) return args;
  let hasBoolean = false;
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'boolean') {
      hasBoolean = true;
      break;
    }
  }
  if (!hasBoolean) return args;
  const trailingIncludeEnd = typeof args[args.length - 1] === 'boolean';
  return args.map((a, i) => {
    if (typeof a !== 'boolean') return a;
    if (!options?.promoteTrailingBoolean && trailingIncludeEnd && i === args.length - 1) {
      return a;
    }
    return new BigNumberCtor(a ? 1 : 0);
  });
}

function patchNodeEvaluate(
  node: { evaluate: (...args: unknown[]) => unknown },
  instanceCtor: CompatDecimalBigNumberCtor
): void {
  const marker = node as { [nodeEvaluateWrapped]?: boolean };
  if (marker[nodeEvaluateWrapped]) return;
  const original = node.evaluate;
  node.evaluate = function (this: unknown, ...args: unknown[]) {
    return compatDecimalResult(original.apply(this, args), instanceCtor);
  };
  marker[nodeEvaluateWrapped] = true;
}

/** Give a native decimal result the compatibility display convention (deep). */
export function compatDecimalResult(
  value: unknown,
  instanceCtor: CompatDecimalBigNumberCtor = CompatBigNumber
): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  // Keep each compat instance's BigNumber class (#1780 — do not re-wrap with another instance's ctor),
  // but upgrade plain module-level CompatBigNumber instances to the owning instance's BigNumber class.
  if (value instanceof CompatBigNumber) {
    if (value.constructor === CompatBigNumber && instanceCtor !== CompatBigNumber) {
      return fixNegativeZeroExponent(new instanceCtor(value.toString()));
    }
    return fixNegativeZeroExponent(value);
  }
  if (value instanceof NativeBigNumber) {
    if (value instanceof instanceCtor) {
      return fixNegativeZeroExponent(value as CompatBigNumber);
    }
    return fixNegativeZeroExponent(new instanceCtor(value.toString()));
  }
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const next = compatDecimalResult(entry, instanceCtor);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (isBridgeMatrix(value)) {
    if ((value as { _values?: unknown[] | null })._values === null) {
      return value;
    }
    let changed = false;
    const mapped = value.map((entry) => {
      const next = compatDecimalResult(entry, instanceCtor);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (isExpressionNode(value)) {
    patchNodeEvaluate(value, instanceCtor);
    return value;
  }
  if (isComplex(value)) {
    const re = compatDecimalResult(value.re, instanceCtor);
    const im = compatDecimalResult(value.im, instanceCtor);
    if (re === value.re && im === value.im) {
      return toCompatComplex(value);
    }
    if (typeof re === 'number' && typeof im === 'number') {
      return toCompatComplex(new Complex(re, im));
    }
    return toCompatComplex(
      Object.assign(Object.create(Object.getPrototypeOf(value) as object), value, { re, im })
    );
  }
  if (isUnit(value)) {
    const unit = value as { value: unknown; clone(): { value: unknown } };
    const wrapped = compatDecimalResult(unit.value, instanceCtor);
    if (wrapped !== unit.value) {
      const copy = unit.clone();
      copy.value = wrapped;
      return copy;
    }
    return value;
  }
  if (isBigNumber(value)) {
    return value;
  }
  if (isFraction(value) && !isMathjsFraction(value)) {
    const f = value as unknown as {
      numerator?: bigint;
      denominator?: bigint;
      valueOf(): unknown;
    };
    if (f.numerator !== undefined && f.denominator !== undefined) {
      return new mathjsFractionClass(f.numerator, f.denominator);
    }
    const raw = f.valueOf();
    if (typeof raw === 'object' && raw !== null && 'n' in raw && 'd' in raw) {
      const parts = raw as { n: bigint; d: bigint };
      return new mathjsFractionClass(parts.n, parts.d);
    }
    if (typeof raw === 'number' && Number.isInteger(raw)) {
      return new mathjsFractionClass(BigInt(raw), 1n);
    }
    const asFrac = value as { toString(): string };
    return new mathjsFractionClass(asFrac.toString());
  }
  return value;
}

// Core decimal operations are immutable and can return a freshly allocated native
// decimal. Keep their digits and the receiving decimal's display convention.
for (const name of Object.getOwnPropertyNames(NativeBigNumber.prototype)) {
  if (Object.hasOwn(CompatBigNumber.prototype, name)) continue;
  const descriptor = Object.getOwnPropertyDescriptor(NativeBigNumber.prototype, name);
  const method = descriptor?.value;
  if (typeof method !== 'function') continue;
  Object.defineProperty(CompatBigNumber.prototype, name, {
    ...descriptor,
    value(this: CompatBigNumber, ...args: unknown[]) {
      const ctor =
        typeof this.constructor === 'function'
          ? (this.constructor as CompatDecimalBigNumberCtor)
          : CompatBigNumber;
      return compatDecimalResult(Reflect.apply(method, this, args), ctor);
    },
  });
}

// mathjs 15.3.0 (decimal.js): `valueOf` is the decimal string, not a JS number.
Object.defineProperty(CompatBigNumber.prototype, 'valueOf', {
  value(this: CompatBigNumber): string {
    return this.toString();
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(CompatBigNumber.prototype, 'toNumber', {
  value(this: CompatBigNumber): number {
    return NativeBigNumber.prototype.valueOf.call(this);
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(CompatBigNumber, 'config', {
  value(config?: Parameters<typeof NativeBigNumber.config>[0]) {
    return NativeBigNumber.config(config);
  },
  writable: true,
  configurable: true,
});

export { CompatBigNumber as BigNumber };

/** Constructor type for compat decimal normalization (#1780). */
export type CompatDecimalBigNumberCtor = new (
  ...args: ConstructorParameters<typeof CompatBigNumber>
) => CompatBigNumber;

/** Instance type for compat decimals (mathjs `BigNumber` / `math.bignumber()`). */
export type CompatBigNumberInstance = CompatBigNumber;

type CompatBignumberInvoke = (value: unknown) => unknown;

/** Per-instance `bignumber()` using the instance BigNumber class (#1780). */
export function createCompatBignumberShim(
  BigNumberCtor: typeof CompatBigNumber,
  invokeNative: CompatBignumberInvoke,
  tooMany: (name: string, max: number, actual: number) => Error
): (...args: unknown[]) => unknown {
  const promote = (value: unknown): unknown => {
    if (value instanceof BigNumberCtor) return value;
    if (isBigNumber(value)) {
      return new BigNumberCtor((value as CompatBigNumber).toString());
    }
    return compatDecimalResult(value, BigNumberCtor);
  };
  return (...callArgs: unknown[]): unknown => {
    if (callArgs.length > 1) {
      invokeNative(callArgs[0]);
      throw tooMany('bignumber', 1, callArgs.length);
    }
    const value = callArgs[0];
    if (value === undefined) {
      return new BigNumberCtor(0);
    }
    if (value instanceof BigNumberCtor) {
      return value;
    }
    if (typeof value === 'bigint') {
      return new BigNumberCtor(value.toString());
    }
    const raw = invokeNative(value);
    if (Array.isArray(raw)) {
      return raw.map((entry) => promote(entry));
    }
    if (typeof raw === 'object' && raw !== null) {
      const matrix = raw as { isMatrix?: boolean; map?: (cb: (x: unknown) => unknown) => unknown };
      if (matrix.isMatrix === true && typeof matrix.map === 'function') {
        return matrix.map((entry) => promote(entry));
      }
    }
    return promote(raw);
  };
}
