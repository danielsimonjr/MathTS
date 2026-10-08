/**
 * SI prefixes for the Unit type.
 *
 * Maps single- and double-letter prefixes to their multiplicative factor in
 * base units. The full SI prefix range (from q = 1e-30 to Q = 1e30) is
 * supported, plus the binary prefixes used for digital information units.
 *
 * @module @danielsimonjr/mathts-core/types/unit-prefixes
 */

import { exactScaleToNumber } from './unit/exact-scale.js';
import { UNIT_PREFIX_SETS, unitPrefixExactScale } from './unit/unit-table.js';

/**
 * Standard SI prefixes (mass/length/energy/etc.), from quecto (q, 1e-30) to
 * quetta (Q, 1e30), read from the unit table's `SHORT` prefix set, plus `µ`
 * as the Unicode spelling of micro beside the ASCII `u`.
 *
 * Note the ambiguity-resolution priority: longer prefixes (e.g. `da`)
 * must be tried before single-letter ones (`d`, `a`) in parsers.
 */
export const SI_PREFIXES: Record<string, number> = (() => {
  const prefixes: Record<string, number> = {};
  const short = UNIT_PREFIX_SETS.SHORT;
  for (const name of Object.keys(short)) {
    if (name === '') continue;
    prefixes[name] = exactScaleToNumber(unitPrefixExactScale(short[name]!));
  }
  prefixes['µ'] = prefixes.u!;
  return prefixes;
})();

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
