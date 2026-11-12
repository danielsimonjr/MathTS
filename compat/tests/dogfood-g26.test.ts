/**
 * Dogfood G26 #735 — scalar add via create(all) vs mathjs 13.
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { create, all } from '../src/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';

function timeLoop(fn: () => void, n: number): number {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return performance.now() - t0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe('G26 #735 create(all).add scalar parity vs mathjs', () => {
  it('ABBA median ratio ≤ 2.0 on Node (issue AC)', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    const ra: number[] = [];
    const rb: number[] = [];
    const n = 5000;
    for (let i = 0; i < 20; i++) {
      mj.add(1, 2);
      mt.add(1, 2);
    }
    for (let r = 0; r < 8; r++) {
      if (r % 2 === 0) {
        ra.push(timeLoop(() => mj.add(1, 2), n));
        rb.push(timeLoop(() => mt.add(1, 2), n));
      } else {
        rb.push(timeLoop(() => mt.add(1, 2), n));
        ra.push(timeLoop(() => mj.add(1, 2), n));
      }
    }
    const ratio = median(rb) / median(ra);
    expect(ratio).toBeLessThan(2.0);
  });
});
