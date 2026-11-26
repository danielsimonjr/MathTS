import { deepFlatten } from '@danielsimonjr/mathts-core/internal';

type FactoryFn = { isFactory?: boolean; fn?: string };

/** True when `value` is a mathjs-style factory object accepted by `create`. */
export function isCompatFactory(value: unknown): value is FactoryFn {
  return (
    typeof value === 'function' &&
    (value as FactoryFn).isFactory === true &&
    typeof (value as FactoryFn).fn === 'string'
  );
}

/** Reject `create` inputs that mathjs `create` would not import (#1575 G20 D4). */
export function assertValidCreateFactories(factories: unknown): void {
  let values: unknown[];
  if (Array.isArray(factories)) {
    values = factories;
  } else if (typeof factories === 'object' && factories !== null) {
    values = Object.values(deepFlatten(factories as Record<string, unknown>));
  } else {
    throw new TypeError('Factory, Object, or Array expected');
  }
  if (values.length === 0) {
    throw new TypeError('Factory, Object, or Array expected');
  }
  for (const value of values) {
    if (!isCompatFactory(value)) {
      throw new TypeError('Factory, Object, or Array expected');
    }
  }
}
