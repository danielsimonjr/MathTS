import {
  BigNumber as NativeBigNumber,
  Complex,
  isBigNumber,
  isComplex,
  isUnit,
} from '@danielsimonjr/mathts-core';

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

function matrixContainsForeignBigNumber(matrix: {
  forEach?: (callback: (entry: unknown) => void) => void;
  toArray?: () => unknown;
}): boolean {
  let found = false;
  if (typeof matrix.forEach === 'function') {
    matrix.forEach((entry) => {
      if (entry instanceof NativeBigNumber && !(entry instanceof CompatBigNumber)) {
        found = true;
      }
    });
    return found;
  }
  const visit = (node: unknown): boolean => {
    if (node instanceof NativeBigNumber && !(node instanceof CompatBigNumber)) return true;
    if (Array.isArray(node)) return node.some(visit);
    return false;
  };
  return matrix.toArray ? visit(matrix.toArray()) : false;
}

/** Give a native decimal result the compatibility display convention (deep). */
export function compatDecimalResult(value: unknown): unknown {
  if (value instanceof NativeBigNumber && !(value instanceof CompatBigNumber)) {
    return new CompatBigNumber(value);
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
    if (!matrixContainsForeignBigNumber(value)) {
      return value;
    }
    return value.map((entry) => compatDecimalResult(entry));
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
    return value;
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
export type CompatBigNumberInstance = CompatBigNumber;
