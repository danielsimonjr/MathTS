import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { assertValidCreateFactories } from '../src/create-factory-validation.js';
import { ensureMathjsFractionToJson } from '../src/fraction-mathjs-json.js';
import { normalizeCompatFormatOptions } from '../src/fraction-format-parity.js';
import { compatReplacer } from '../src/serialization.js';

describe('G20 coverage branches (#1575)', () => {
  it('assertValidCreateFactories rejects invalid create inputs', () => {
    expect(() => assertValidCreateFactories({ fn: () => 1 })).toThrow(TypeError);
    expect(() => assertValidCreateFactories([])).toThrow(TypeError);
    expect(() => assertValidCreateFactories('not-a-factory')).toThrow(TypeError);
  });

  it('ensureMathjsFractionToJson is idempotent', () => {
    const math = create(all);
    const f = math.fraction(1, 3);
    const wrapped = ensureMathjsFractionToJson(f);
    expect(ensureMathjsFractionToJson(wrapped)).toBe(wrapped);
    expect(JSON.stringify(f)).toBe('{"mathjs":"Fraction","n":"1","d":"3"}');
  });

  it('normalizeCompatFormatOptions coerces BigNumber precision', () => {
    const math = create(all, { number: 'BigNumber' });
    const opts = normalizeCompatFormatOptions(math.bignumber(3));
    expect(opts).toEqual({ precision: 3 });
    expect(math.format(math.pi, math.bignumber(3))).toBe('3.14');
    expect(math.evaluate('format(pi, 3)')).toBe('3.14');
  });

  it('compatReplacer tags BigNumber values like mathjs', () => {
    const math = create(all, { number: 'BigNumber' });
    const bn = math.bignumber('1.5');
    const tagged = JSON.parse(JSON.stringify({ x: bn }, math.replacer)) as {
      x: { mathjs: string; value: string };
    };
    expect(tagged.x.mathjs).toBe('BigNumber');
    expect(typeof tagged.x.value).toBe('string');
    const plain = compatReplacer.call({ x: bn }, 'x', bn) as { mathjs: string };
    expect(plain.mathjs).toBe('BigNumber');
  });
});
