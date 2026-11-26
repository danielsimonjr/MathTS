import { MathjsError } from '@danielsimonjr/mathts-core/internal';

/** mathjs factory function plus `isFactory`, `fn`, and `dependencies` metadata. */
export type CompatFactory = ((scope: Record<string, unknown>) => unknown) & {
  isFactory: true;
  fn: string;
  dependencies: string[];
};

/** mathjs 15.3.0 throws plain `Error` for missing factory dependencies (#1575 G20 D5). */
export function wrapFactoryMathjsErrors(factory: CompatFactory): CompatFactory {
  const inner = factory;
  const wrapped = function wrapped(scope: Record<string, unknown>): unknown {
    try {
      return inner(scope);
    } catch (error) {
      if (error instanceof MathjsError) {
        throw new Error(error.message);
      }
      throw error;
    }
  };
  Object.assign(wrapped, inner);
  return wrapped as CompatFactory;
}

/** Wrap `math.factory` so instantiated factories match mathjs error types. */
export function wrapFactoryCreator(
  create: (...args: unknown[]) => CompatFactory
): (...args: unknown[]) => CompatFactory {
  return (...args: unknown[]) => wrapFactoryMathjsErrors(create(...args));
}
