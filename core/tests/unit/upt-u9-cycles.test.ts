import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

describe('UPT U9: to() reports the cycle bridge', () => {
  it('exact scale of Hz is 1', () => {
    expect(exactScaleToNumber(Unit.exactScale('Hz')!)).toBe(1);
  });

  it('Hz to rad/s has cycles 1 and the clone keeps it', () => {
    const u = Unit.parse('1 Hz').to('rad/s');
    expect(u.value).toBeCloseTo(2 * Math.PI, 12);
    expect(u.cycles).toBe(1);
    expect(u.clone().cycles).toBe(1);
  });

  it('Hz to s^-1 has cycles 0 and value 1', () => {
    const u = Unit.parse('1 Hz').to('s^-1');
    expect(u.value).toBeCloseTo(1, 12);
    expect(u.cycles).toBe(0);
  });

  it('rad/s to Hz has cycles -1', () => {
    expect(Unit.parse('3 rad/s').to('Hz').cycles).toBe(-1);
  });

  it('a parsed unit has cycles 0', () => {
    expect(Unit.parse('1 Hz').cycles).toBe(0);
  });
});
