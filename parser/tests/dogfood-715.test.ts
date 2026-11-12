import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

/** Issue #715 — createParse() needs factories; `parse` works from the package entry. */
describe('#715 mathts-parser standalone parse', () => {
  it('parse("2+2") without createParse bootstrap', () => {
    expect(() => parse('2+2')).not.toThrow();
    expect(parse('2+2')).toBeDefined();
  });
});
