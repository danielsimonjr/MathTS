import { type BigNumber, Fraction, mathTyped } from '@danielsimonjr/mathts-core';
import { deepMap } from '@danielsimonjr/mathts-core/internal';

/** Build a typed numerator or denominator function for scalars and collections. */
export function fractionPart(
  name: 'num' | 'den',
  key: 'numerator' | 'denominator',
  typed: typeof mathTyped = mathTyped,
  fraction: (value: BigNumber | number) => Fraction = (value) => new Fraction(value)
) {
  const read = (value: Fraction) =>
    typeof value[key] === 'bigint' ? value[key] : new Fraction(String(value))[key];

  return typed(name, {
    Fraction: read,
    BigNumber: (value: BigNumber) => read(fraction(value)),
    boolean: (value: boolean) => read(fraction(Number(value))),
    'Array | Matrix': typed.referToSelf(
      (self) => (values: Parameters<typeof deepMap>[0]) => deepMap(values, (value) => self(value))
    ),
  });
}

export const num = fractionPart('num', 'numerator');
export const den = fractionPart('den', 'denominator');
