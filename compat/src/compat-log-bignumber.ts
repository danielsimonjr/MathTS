/**
 * mathjs 15.3.0 natural log on BigNumber matches decimal.js `ln` at instance precision (#1787).
 */

import { Decimal } from 'decimal.js';
import { isOwnBigNumber } from './mathjs-parity-g02.js';
import { INSTANCE_PRECISION_GETTER } from './compat-bignumber-instance.js';
import { compatDecimalResult } from './bignumber.js';

function instancePrecision(operand: unknown): number {
  if (
    typeof operand === 'object' &&
    operand !== null &&
    typeof operand.constructor === 'function'
  ) {
    const getter = (operand.constructor as unknown as Record<symbol, unknown>)[
      INSTANCE_PRECISION_GETTER
    ];
    if (typeof getter === 'function') {
      return (getter as () => number)();
    }
  }
  return 64;
}

/** Route unary positive BigNumber `log` through decimal.js so coefficients match mathjs 15.3.0. */
export function withCompatLogBigNumberDecimalJs(
  fn: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length !== 1 || !isOwnBigNumber(args[0])) {
      return fn(...args);
    }
    const x = args[0] as {
      toString(): string;
      isNegative(): boolean;
      constructor: new (s: string) => unknown;
    };
    if (x.isNegative()) {
      return fn(...args);
    }
    const precision = instancePrecision(x);
    const prev = Decimal.precision;
    Decimal.set({ precision });
    try {
      const ln = new Decimal(x.toString()).ln();
      return compatDecimalResult(
        new x.constructor(ln.toString()),
        x.constructor as import('./bignumber.js').CompatDecimalBigNumberCtor
      );
    } finally {
      Decimal.set({ precision: prev });
    }
  };
}
