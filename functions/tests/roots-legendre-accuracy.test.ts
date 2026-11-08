import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rootsLegendre } from '../src/index.js';

// Weights from mpmath at 60 digits (Newton on the three-term recurrence to 1e-55,
// weight 2 / ((1 - x²) P'_n(x)²)), rounded to 25 digits, ascending nodes.
const REF: Record<string, string[]> = JSON.parse(
  readFileSync(new URL('./fixtures/gauss-legendre-mpmath60.json', import.meta.url), 'utf8')
);

function maxRelWeightError(n: number): number {
  const { weights } = rootsLegendre(n);
  const ref = REF[String(n)];
  expect(weights).toHaveLength(n);
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const r = Number(ref[i]);
    worst = Math.max(worst, Math.abs(weights[i] - r) / r);
  }
  return worst;
}

describe('rootsLegendre weights (UPT plan task M3)', () => {
  it('16 points: every weight within 5e-16 relative (the UPT local table is 2.0e-15)', () => {
    expect(maxRelWeightError(16)).toBeLessThanOrEqual(5e-16);
  });

  it('n = 2..64: every weight within 1e-15 relative', () => {
    const bad: string[] = [];
    for (let n = 2; n <= 64; n++) {
      const e = maxRelWeightError(n);
      if (e > 1e-15) bad.push(`n=${n}: ${e.toExponential(2)}`);
    }
    expect(bad).toEqual([]);
  });
});
