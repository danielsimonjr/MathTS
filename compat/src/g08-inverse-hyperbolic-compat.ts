/** G08 compat instance overrides — re-export bundle for `create(all)`. */

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
    acosh: wrapG08InverseHyperbolic(factories.factory_acosh, complexJsAcosh, {
      recompute: (x) => x > -1 && x < 1,
    }),
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
