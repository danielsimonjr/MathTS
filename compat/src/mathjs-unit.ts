/**
 * Per-instance unit constructor for compat. G01 (#1557): `isValuelessUnit('d')`
 * is false on the instance (mathjs 15.3.0 does not treat bare `d` as a unit
 * prefix in expressions). G14 (#1730) owns `Unit.UNITS` / the mathjs catalog
 * (`wrapCompatUnitClass` on that branch). This helper must not mutate the
 * shared native `Unit` class: `create(all)` with default config binds core
 * `Unit`, not an instance-local subclass.
 *
 * When #1730 merges, fold the `'d'` exception into
 * `MATHJS_IS_VALUELESS_UNIT` (already absent there) and call
 * `wrapCompatUnitClass` from `wrapCompatUnitSources` instead of stacking a
 * second patch here.
 */

/** Constructable unit class with `isValuelessUnit`. */
export type CompatUnitConstructorLike = (new (...args: never[]) => unknown) & {
  isValuelessUnit: (name: string) => boolean;
};

/**
 * Return a real constructor that delegates to `Base` without rewriting
 * `Base.isValuelessUnit` or `Base.UNITS`. `new` and `instanceof` work;
 * native `Unit` is unchanged.
 */
export function wrapCompatUnitConstructor<T extends CompatUnitConstructorLike>(Base: T): T {
  const baseIsValuelessUnit = Base.isValuelessUnit.bind(Base);

  function CompatUnit(this: unknown, ...args: unknown[]): unknown {
    return Reflect.construct(Base, args, new.target ?? CompatUnit);
  }

  Object.setPrototypeOf(CompatUnit, Base);
  // Share Base.prototype so factory-built units (`math.unit('1 m')`) stay
  // `instanceof math.Unit` without mutating Base itself.
  CompatUnit.prototype = Base.prototype;
  Object.defineProperty(CompatUnit, 'name', { value: Base.name });
  CompatUnit.isValuelessUnit = (name: string): boolean => {
    if (name === 'd') return false;
    return baseIsValuelessUnit(name);
  };
  return CompatUnit as unknown as T;
}
