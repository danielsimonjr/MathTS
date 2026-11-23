import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discriminant,
  nullspace,
  padeApproximant,
  poly_discriminant_f64,
  poly_resultant_f64,
  resultant,
} from '../build/mathts.js';

test('the Padé solve and nullspace preserve scaled equations (#1366)', () => {
  const s = 2 ** -100;
  assert.deepEqual(
    padeApproximant(Float64Array.of(s, s, 0.5 * s), 1, 1),
    Float64Array.of(s, 0.5 * s, 1, -0.5)
  );
  assert.deepEqual(nullspace(Float64Array.of(s, 2 * s), 1, 2), Float64Array.of(-2, 1));
});

test('both Sylvester determinant paths keep nonzero resultants and discriminants (#1366)', () => {
  const s = 2 ** -100;
  for (const kernel of [resultant, poly_resultant_f64]) {
    assert.equal(kernel(Float64Array.of(s, s), Float64Array.of(2 * s, s)), s * s);
  }
  for (const kernel of [discriminant, poly_discriminant_f64]) {
    assert.equal(kernel(Float64Array.of(2 * s, -3 * s, s)), s * s);
  }
});
