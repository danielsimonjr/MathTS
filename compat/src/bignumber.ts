import {
  BigNumber as NativeBigNumber,
  Complex,
  isBigNumber,
  isComplex,
  isUnit,
} from '@danielsimonjr/mathts-core';

/** decimal.js (and mathjs) use exponent `0`, never `-0`, in deep equality tests. */
function fixNegativeZeroExponent(bn: CompatBigNumber): CompatBigNumber {
  const exponent = (bn as unknown as { _exponent: number })._exponent;
  if (Object.is(exponent, -0)) {
    return new CompatBigNumber(bn.toString());
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
  args: readonly unknown[],
  BigNumberCtor: typeof CompatBigNumber
): unknown[] {
  const hasBigNumber = args.some(
    (a) => a instanceof CompatBigNumber || (a instanceof NativeBigNumber && isBigNumber(a))
  );
  if (!hasBigNumber) return [...args];
  return args.map((a) => (typeof a === 'boolean' ? new BigNumberCtor(a ? 1 : 0) : a));
}

function patchNodeEvaluate(node: { evaluate: (...args: unknown[]) => unknown }): void {
  const marker = node as { [nodeEvaluateWrapped]?: boolean };
  if (marker[nodeEvaluateWrapped]) return;
  const original = node.evaluate;
  node.evaluate = function (this: unknown, ...args: unknown[]) {
    return compatDecimalResult(original.apply(this, args));
  };
  marker[nodeEvaluateWrapped] = true;
}

/** Give a native decimal result the compatibility display convention (deep). */
export function compatDecimalResult(value: unknown): unknown {
  if (value instanceof NativeBigNumber) {
    if (!(value instanceof CompatBigNumber)) {
      return fixNegativeZeroExponent(new CompatBigNumber(value));
    }
    return fixNegativeZeroExponent(value);
  }
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const next = compatDecimalResult(entry);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (isBridgeMatrix(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const next = compatDecimalResult(entry);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (isExpressionNode(value)) {
    patchNodeEvaluate(value);
    return value;
  }
  if (isComplex(value)) {
    const re = compatDecimalResult(value.re);
    const im = compatDecimalResult(value.im);
    if (re === value.re && im === value.im) {
      return value;
    }
    if (typeof re === 'number' && typeof im === 'number') {
      return new Complex(re, im);
    }
    return Object.assign(Object.create(Object.getPrototypeOf(value) as object), value, { re, im });
  }
  if (isUnit(value)) {
    const unit = value as { value: unknown; clone(): { value: unknown } };
    const wrapped = compatDecimalResult(unit.value);
    if (wrapped !== unit.value) {
      const copy = unit.clone();
      copy.value = wrapped;
      return copy;
    }
    return value;
  }
  if (isBigNumber(value)) {
    return value instanceof CompatBigNumber ? fixNegativeZeroExponent(value) : value;
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
      return compatDecimalResult(Reflect.apply(method, this, args));
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

/** Instance type for compat decimals (mathjs `BigNumber` / `math.bignumber()`). */
export type CompatBigNumberInstance = CompatBigNumber;
