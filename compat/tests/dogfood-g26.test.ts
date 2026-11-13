/**
 * Dogfood G26 #735 — scalar add via create(all) vs mathjs 13.
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';

describe('G26 #735 create(all).add scalar parity vs mathjs', () => {
  // The speed bound against mathjs (ratio < 2.0) is the "compat-add" gate of
  // tools/test/wall-clock-gates.json. It runs in its own CI step, not in this suite.
  it('add(1,2) matches mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    expect(mt.add(1, 2)).toBe(mj.add(1, 2));
    expect(mt.add(1, 2)).toBe(3);
  });
});
