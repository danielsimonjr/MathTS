/**
 * Internal names of the functions namespace (#1216).
 *
 * The functions namespace exports factory functions (`factory_*`) and tuning
 * constants (`GPU_MIN_ELEMENTS`, `GL4_A`, ...) for its own packages and tests. They are
 * not part of the mathjs instance API, so a compat instance does not surface them.
 * They stay importable from `@danielsimonjr/mathts-functions`.
 *
 * The rule is a name shape: `factory_` followed by a name, or a name of capital
 * letters, digits and underscores. The mathjs-parity names that have this shape
 * (`LN2`, `SQRT1_2`, ...) are API and stay.
 *
 * @packageDocumentation
 */

/** The shape of an internal name: `factory_*` or ALL_CAPS. */
const INTERNAL_NAME_SHAPE = /^(?:factory_|[A-Z][A-Z0-9_]*$)/;

/**
 * Tells whether a name of the functions namespace is internal.
 *
 * @param key - The name.
 * @param parityNames - The mathjs-parity names. A name in this set is never internal.
 * @returns `true` when the compat instance must not surface the name.
 */
export function isInternalName(key: string, parityNames: ReadonlySet<string>): boolean {
  return INTERNAL_NAME_SHAPE.test(key) && !parityNames.has(key);
}
