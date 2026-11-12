/**
 * Dogfood G26 #735 — scalar add via create(all) vs mathjs 13.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { create, all } from '../src/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';
import { nodeBinary } from '../../functions/tests/helpers/node-binary.js';

describe('G26 #735 create(all).add scalar parity vs mathjs', () => {
  it('add(1,2) matches mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    expect(mt.add(1, 2)).toBe(mj.add(1, 2));
  });

  it('ABBA median ratio ≤ 2.0 on Node (issue AC)', () => {
    const gate = fileURLToPath(new URL('./helpers/compat-add-perf-gate.mjs', import.meta.url));
    const raw = execFileSync(nodeBinary(), [gate], { encoding: 'utf8' }).trim();
    const { ratio, parity } = JSON.parse(raw) as { ratio: number; parity: number };
    expect(parity).toBe(3);
    expect(ratio).toBeLessThan(2.0);
  });
});
