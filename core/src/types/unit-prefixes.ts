/**
 * SI prefixes for the Unit type.
 *
 * Maps single- and double-letter prefixes to their multiplicative factor in
 * base units. The full SI prefix range (from y = 1e-24 to Y = 1e24) is
 * supported, plus the binary prefixes used for digital information units.
 *
 * @module @danielsimonjr/mathts-core/types/unit-prefixes
 */

/**
 * Standard SI prefixes (mass/length/energy/etc.).
 *
 * Note the ambiguity-resolution priority: longer prefixes (e.g. `da`)
 * must be tried before single-letter ones (`d`, `a`) in parsers.
 */
export const SI_PREFIXES: Record<string, number> = {
  // Positive powers of ten
  Y: 1e24, // yotta
  Z: 1e21, // zetta
  E: 1e18, // exa
  P: 1e15, // peta
  T: 1e12, // tera
  G: 1e9, // giga
  M: 1e6, // mega
  k: 1e3, // kilo
  h: 1e2, // hecto
  da: 1e1, // deka (two-letter)

  // Negative powers of ten
  d: 1e-1, // deci
  c: 1e-2, // centi
  m: 1e-3, // milli
  u: 1e-6, // micro (ASCII fallback)
  µ: 1e-6, // micro (Unicode)
  n: 1e-9, // nano
  p: 1e-12, // pico
  f: 1e-15, // femto
  a: 1e-18, // atto
  z: 1e-21, // zepto
  y: 1e-24, // yocto
};

/**
 * Ordered list of prefixes, longest-first.
 *
 * Used by the parser to ensure `"da"` is matched before `"d"`, etc.
 */
export const SI_PREFIX_KEYS: ReadonlyArray<string> = Object.keys(SI_PREFIXES).sort(
  (a, b) => b.length - a.length
);

/**
 * Set of "good" prefixes to use in `toBest()` selection.
 *
 * Excludes `h`, `da`, `d`, `c` (commonly only used for centimeters and similar
 * legacy notations); using these in `toBest()` would produce awkward outputs
 * like "0.4 hg" instead of "40 g".
 */
export const BEST_PREFIXES: ReadonlyArray<string> = [
  'Y',
  'Z',
  'E',
  'P',
  'T',
  'G',
  'M',
  'k',
  '',
  'm',
  'u',
  'n',
  'p',
  'f',
  'a',
  'z',
  'y',
];

/**
 * Look up an SI prefix multiplier. Returns `undefined` if not a known prefix.
 */
export function getPrefix(name: string): number | undefined {
  return SI_PREFIXES[name];
}
