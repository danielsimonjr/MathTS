import { isBigNumber } from '@danielsimonjr/mathts-core';
import { BigNumber } from './bignumber.js';
import { evaluate, factory_mathjsCompat, runWithConfig } from '@danielsimonjr/mathts-functions';
import { MATHJS_UNIT_CONSTANTS } from './parity-names.generated.js';

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

/** Constant names whose values are configured by a compat instance. */
export type CompatConstantName =
  keyof typeof mathConstants | keyof typeof scalarConstants | 'Infinity' | 'NaN';

const Unit = factory_mathjsCompat.constructors.Unit;
/** Resolve the MathJS numeric value of a constant using the supplied configuration. */
export function configuredMathjsConstant(
  name: keyof typeof mathConstants | 'Infinity' | 'NaN',
  value: number,
  config: Parameters<typeof runWithConfig>[0]
): number | import('@danielsimonjr/mathts-core').BigNumber {
  if (config.number !== 'BigNumber') return value;
  if (name === 'Infinity' || name === 'NaN') return new BigNumber(value);
  const canonical = mathConstants[name];
  return runWithConfig(config, () => {
    // MathJS rounds each operation in (sqrt(5) + 1) / 2 at the configured precision.
    if (canonical === 'phi') return new BigNumber(5).sqrt().add(1).divide(2);
    const result: unknown = evaluate(canonical === 'tau' ? 'pi' : canonical);
    if (!isBigNumber(result)) {
      throw new TypeError(`Expected a BigNumber constant for ${canonical}`);
    }
    // MathJS derives tau by doubling the already rounded pi.
    const decimal = new BigNumber(result);
    return canonical === 'tau' ? decimal.multiply(2) : decimal;
  });
}

/** Prepare live reads before the instance defines its property layout. */
export function compatConstantReaders(
  surface: Record<string, unknown>,
  config: Parameters<typeof runWithConfig>[0],
  UnitClass: typeof Unit,
  isDefault: (name: string) => boolean
): Record<string, () => unknown> {
  const reads: Record<string, () => unknown> = {};
  const bind = (name: string, read: () => unknown): void => {
    if (Object.hasOwn(surface, name)) reads[name] = read;
  };
  for (const name of Object.keys(mathConstants) as (keyof typeof mathConstants)[]) {
    const number = surface[name] as number;
    let precision: number | undefined;
    let precise: ReturnType<typeof configuredMathjsConstant> | undefined;
    bind(name, () => {
      if (config.number !== 'BigNumber') return number;
      if (precise === undefined || precision !== config.precision) {
        precise = configuredMathjsConstant(name, number, config);
        precision = config.precision;
      }
      return precise;
    });
  }
  for (const [name, number] of Object.entries(scalarConstants)) {
    if (!isDefault(name)) continue;
    bind(name as keyof typeof scalarConstants, () =>
      config.number === 'BigNumber' ? new BigNumber(number) : number
    );
  }
  for (const [name, value, units, decimalValue] of MATHJS_UNIT_CONSTANTS) {
    if (!isDefault(name)) continue;
    let cached: InstanceType<typeof Unit> | undefined;
    let precise: InstanceType<typeof Unit> | undefined;
    let precision: number | undefined;
    bind(name, () => {
      if (config.number !== 'BigNumber') {
        if (!cached) {
          cached = new UnitClass(value, units);
          cached.fixPrefix = true;
        }
        return cached;
      }
      if (precise === undefined || precision !== config.precision) {
        precise = runWithConfig(config, () => {
          const magnitude = new BigNumber(
            decimalValue ?? String(value)
          ) as unknown as ConstructorParameters<typeof Unit>[0];
          const unit = new UnitClass(magnitude, units);
          unit.fixPrefix = true;
          return unit;
        });
        precision = config.precision;
      }
      return precise;
    });
  }
  bind('Infinity', () => (config.number === 'BigNumber' ? new BigNumber(Infinity) : Infinity));
  bind('NaN', () => (config.number === 'BigNumber' ? new BigNumber(NaN) : NaN));
  return reads;
}
