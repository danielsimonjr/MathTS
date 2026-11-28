/**
 * mathjs fraction.js scalar pairs for add / subtract / multiply / divide routing (#1787).
 * Shared by factory scalars and typed public `add` / `subtract` / `multiply` shims.
 */

import {
  isMathjsFraction,
  mathjsFractionClass,
  type MathjsFraction,
} from './mathjs-fraction-class.js';
import { shouldUseFactoryScalarForFractionPair } from './mathjs-parity-1787-arithmetic.js';

/** Parse a numeric string for fraction.js pairs (mathjs accepts `"2"` beside Fraction). */
function numericStringOperand(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  const n = Number(x);
  return x.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** mathjs fraction.js `add` for public `add` (matches mathjs decimal+fraction pairs). */
export function mathjsFractionAdd(a: unknown, b: unknown): unknown | null {
  const bNum = typeof b === 'number' ? b : numericStringOperand(b);
  const aNum = typeof a === 'number' ? a : numericStringOperand(a);
  if (isMathjsFraction(a) && (isMathjsFraction(b) || bNum !== null)) {
    return a.add((bNum ?? b) as number | MathjsFraction);
  }
  if (isMathjsFraction(b) && (isMathjsFraction(a) || aNum !== null)) {
    const left = isMathjsFraction(a)
      ? a
      : (new mathjsFractionClass(aNum as number) as MathjsFraction);
    return left.add(b as number | MathjsFraction);
  }
  return null;
}

/** Factory-scalar `add` skips fraction.js when mathjs routes through `addScalar` instead. */
export function mathjsFactoryFractionAdd(a: unknown, b: unknown): unknown | null {
  if (shouldUseFactoryScalarForFractionPair(a, b)) return null;
  return mathjsFractionAdd(a, b);
}

/** mathjs fraction.js `sub` when both sides are exact-enough for fraction.js. */
export function mathjsFractionSub(a: unknown, b: unknown): unknown | null {
  if (isMathjsFraction(a) && (isMathjsFraction(b) || typeof b === 'number')) {
    return a.sub(b as number | MathjsFraction);
  }
  if (isMathjsFraction(b) && (isMathjsFraction(a) || typeof a === 'number')) {
    const left = isMathjsFraction(a) ? a : (new mathjsFractionClass(a as number) as MathjsFraction);
    return left.sub(b as number | MathjsFraction);
  }
  return null;
}

/** Coerce bigint × mathjs Fraction through fraction.js before factory scalars (#1787). */
export function mathjsBigIntFractionPair(
  op: 'add' | 'sub' | 'mul' | 'div',
  a: unknown,
  b: unknown
): unknown | null {
  const method = { add: 'add', sub: 'sub', mul: 'mul', div: 'div' } as const;
  if (typeof a === 'bigint' && isMathjsFraction(b)) {
    return (new mathjsFractionClass(a.toString()) as MathjsFraction)[method[op]](b);
  }
  if (typeof b === 'bigint' && isMathjsFraction(a)) {
    return (a as MathjsFraction)[method[op]](
      new mathjsFractionClass(b.toString()) as MathjsFraction
    );
  }
  return null;
}
