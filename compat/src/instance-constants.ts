import { BigNumber, Unit } from '@danielsimonjr/mathts-core';
import { evaluate, runWithConfig } from '@danielsimonjr/mathts-functions';
import { MATHJS_UNIT_CONSTANTS } from './parity-names.generated.js';
import type { MathJSConfig } from './index.js';

const mathConstants = {
  E: 'e',
  PI: 'pi',
  e: 'e',
  pi: 'pi',
  tau: 'tau',
  phi: 'phi',
  LN2: 'LN2',
  LN10: 'LN10',
  LOG2E: 'LOG2E',
  LOG10E: 'LOG10E',
  SQRT1_2: 'SQRT1_2',
  SQRT2: 'SQRT2',
} as const;

// Mathjs 15.2 constants. The functions package exposes its newer CODATA data
// and associated uncertainties independently of the compatibility instance.
const scalarConstants = {
  efimovFactor: 22.7,
  fineStructure: 0.0072973525693,
  sackurTetrode: -1.16487052358,
  weakMixingAngle: 0.2229,
} as const;

export type CompatConstantName =
  keyof typeof mathConstants | keyof typeof scalarConstants | 'Infinity' | 'NaN';

/** One source of configured values for instance reads and compiled expressions. */
export function wireCompatConstants(
  instance: Record<string, unknown>,
  config: MathJSConfig,
  isDefault: (name: string) => boolean
): Record<string, () => unknown> {
  const expressionConstants: Record<string, () => unknown> = {};
  const bind = (name: string, read: () => unknown): void => {
    if (!Object.hasOwn(instance, name)) return;
    let overwritten = false;
    let override: unknown;
    Object.defineProperty(instance, name, {
      enumerable: true,
      configurable: true,
      get: () => (overwritten ? override : read()),
      set(value: unknown) {
        if (Object.isFrozen(instance))
          throw new TypeError(`Cannot assign to read only property '${name}'`);
        overwritten = true;
        override = value;
      },
    });
    if (name !== 'Infinity' && name !== 'NaN') expressionConstants[name] = () => instance[name];
  };
  for (const [name, canonical] of Object.entries(mathConstants)) {
    const number = instance[name] as number;
    let precision: number | undefined;
    let precise: BigNumber | undefined;
    bind(name as keyof typeof mathConstants, () => {
      if (config.number !== 'BigNumber') return number;
      if (precise === undefined || precision !== config.precision) {
        const value: unknown = runWithConfig(config, () => {
          const value: unknown = evaluate(canonical === 'tau' ? 'pi' : canonical);
          // Mathjs derives tau by doubling the already rounded pi.
          return canonical === 'tau' && value instanceof BigNumber ? value.multiply(2) : value;
        });
        if (!(value instanceof BigNumber)) {
          throw new TypeError(`Expected a BigNumber constant for ${canonical}`);
        }
        precise = value;
        precision = config.precision;
      }
      return precise;
    });
  }
  for (const [name, number] of Object.entries(scalarConstants)) {
    if (!isDefault(name)) continue;
    bind(name as keyof typeof scalarConstants, () =>
      config.number === 'BigNumber' ? BigNumber.fromNumber(number) : number
    );
  }
  for (const [name, value, units] of MATHJS_UNIT_CONSTANTS) {
    if (!isDefault(name)) continue;
    let cached: InstanceType<typeof Unit> | undefined;
    bind(name, () => (cached ??= new Unit(value, units)));
  }
  bind('Infinity', () =>
    config.number === 'BigNumber' ? BigNumber.fromNumber(Infinity) : Infinity
  );
  bind('NaN', () => (config.number === 'BigNumber' ? BigNumber.fromNumber(NaN) : NaN));
  return expressionConstants;
}
