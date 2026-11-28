import { factory_gcd } from '@danielsimonjr/mathts-functions';
import { compatDecimalResult } from './bignumber.js';
import { instanceSymbols } from './instance-symbols.js';

function withTypedSurface<T extends object>(shim: T, typedFn: object): T {
  for (const key of Reflect.ownKeys(typedFn)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(typedFn, key);
    if (desc) Object.defineProperty(shim, key, desc);
  }
  return shim;
}

const _compatGcd = withTypedSurface((...args: unknown[]): unknown => {
  try {
    return compatDecimalResult((factory_gcd as (...a: unknown[]) => unknown)(...args));
  } catch (err) {
    if (err instanceof Error && err.message === 'gcd() supports only 1d matrices!') {
      const ArgsError = instanceSymbols.ArgumentsError as unknown as new (fn: string) => Error;
      throw new ArgsError('gcd() supports only 1d matrices!');
    }
    throw err;
  }
}, factory_gcd);

/**
 * Instance `gcd` on `create(all)` — mathjs factory wrapper with `ArgumentsError` parity.
 * The module export `gcd` stays the functions implementation alias (#1785 oracle).
 */
export function compatInstanceGcd(...args: unknown[]): unknown {
  return _compatGcd(...args);
}
