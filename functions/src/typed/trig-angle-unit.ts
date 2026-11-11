/**
 * Shared angle-Unit handling for typed trigonometry (mathjs parity).
 *
 * The unit's SI-normalized {@link UnitInstance.value} is already in radians;
 * apply the numeric kernel to that value.
 */
import { Complex, isComplex } from '@danielsimonjr/mathts-core';
import type { UnitInstance } from '@danielsimonjr/mathts-core';
import { DimensionError } from '../error/DimensionError.js';

type TrigKernel = (x: number) => number;
type ComplexTrigKernel = (x: Complex) => Complex;

export function trigFromAngleUnit(
  u: UnitInstance,
  fnName: string,
  numberKernel: TrigKernel,
  complexKernel: ComplexTrigKernel
): number | Complex {
  if (!u.hasBase('ANGLE')) {
    throw new DimensionError(`Unit in function ${fnName} is no angle`);
  }
  if (u.value === null || u.value === undefined) {
    throw new TypeError(`Cannot apply ${fnName} to a valueless unit`);
  }
  const v = u.value;
  if (typeof v === 'number') return numberKernel(v);
  if (isComplex(v)) return complexKernel(v as Complex);
  throw new TypeError(
    `Unexpected type of angle unit value in function ${fnName} (expected: number or Complex)`
  );
}
