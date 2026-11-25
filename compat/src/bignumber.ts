import { BigNumber as NativeBigNumber } from '@danielsimonjr/mathts-core';

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

/** Give a native decimal result the compatibility display convention. */
export function compatDecimalResult(value: unknown): unknown {
  return value instanceof NativeBigNumber && !(value instanceof CompatBigNumber)
    ? new CompatBigNumber(value)
    : value;
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

export { CompatBigNumber as BigNumber };
