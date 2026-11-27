/** G08 compat instance overrides — re-export bundle for `create(all)`. */

import { isBigNumber } from '@danielsimonjr/mathts-core';
import {
  BigNumber as CompatBigNumber,
  compatDecimalResult,
  getCompatDecimalBigNumberCtor,
} from './bignumber.js';
import {
  complexJsAcosh,
  complexJsAcoth,
  complexJsAcsc,
  complexJsAcsch,
  complexJsAsec,
  complexJsAsech,
  complexJsAsinh,
  complexJsAtanh,
  recomputeInsideUnitDisk,
  wrapG08InverseHyperbolic,
} from './complex-js-inverse-hyperbolic.js';

type Fn = (...args: unknown[]) => unknown;

function withBigNumberAcoshAtOne(fn: Fn): Fn {
  return (...args: unknown[]): unknown => {
    const x = args[0];
    if (isBigNumber(x) && (x as { eq(n: unknown): boolean }).eq(1)) {
      return compatDecimalResult(new (getCompatDecimalBigNumberCtor() as typeof CompatBigNumber)(0));
    }
    return fn(...args);
  };
}

/** Typed-function entry points overridden for G08 on `create(all)`. */
export type G08FactoryBundle = {
  factory_asinh: Fn;
  factory_acosh: Fn;
  factory_atanh: Fn;
  acoth: Fn;
  acsch: Fn;
  asech: Fn;
  factory_acsc: Fn;
  factory_asec: Fn;
};

/** Build wrapped G08 factories for `compatDefaultOverrides`. */
export function applyG08CompatOverrides(factories: G08FactoryBundle): {
  asinh: Fn;
  acosh: Fn;
  atanh: Fn;
  acoth: Fn;
  acsch: Fn;
  asech: Fn;
  acsc: Fn;
  asec: Fn;
} {
  return {
    asinh: wrapG08InverseHyperbolic(factories.factory_asinh, complexJsAsinh, {
      recompute: () => true,
    }),
    acosh: withBigNumberAcoshAtOne(
      wrapG08InverseHyperbolic(factories.factory_acosh, complexJsAcosh, {
        recompute: (x) => x > -1 && x < 1,
      })
    ),
    atanh: wrapG08InverseHyperbolic(factories.factory_atanh, complexJsAtanh, {
      recompute: (x) => x < -1 || x > 1,
    }),
    acoth: wrapG08InverseHyperbolic(factories.acoth, complexJsAcoth, {
      zeroCase: 'acoth',
      recompute: (x) => x > -1 && x < 1,
    }),
    acsch: wrapG08InverseHyperbolic(factories.acsch, complexJsAcsch, { recompute: () => true }),
    asech: wrapG08InverseHyperbolic(factories.asech, complexJsAsech, {
      recompute: (x) => x < -1 || x > 1,
    }),
    acsc: wrapG08InverseHyperbolic(factories.factory_acsc, complexJsAcsc, {
      zeroCase: 'acsc',
      recompute: recomputeInsideUnitDisk,
    }),
    asec: wrapG08InverseHyperbolic(factories.factory_asec, complexJsAsec, {
      zeroCase: 'asec',
      recompute: recomputeInsideUnitDisk,
    }),
  };
}
