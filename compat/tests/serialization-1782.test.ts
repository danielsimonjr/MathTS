/**
 * #1782 — JSON replacer/reviver round-trip for Parser, Chain, and Help.
 */
import { describe, it, expect } from 'vitest';
import { Fraction as CoreFraction } from '@danielsimonjr/mathts-core';
import { create, all } from '../src/index.js';
import { compatReplacer, reviveInstanceValue } from '../src/serialization.js';

describe('#1782 JSON serialization', () => {
  const math = create(all);

  it('stringifies and revives Parser state like mathjs', () => {
    const parser = new math.Parser();
    parser.evaluate('a = 42');
    parser.evaluate('w = bignumber(2)');
    parser.evaluate('f(x) = w * x');
    parser.evaluate('c = f(3)');

    const json = {
      mathjs: 'Parser',
      variables: {
        a: 42,
        c: { mathjs: 'BigNumber', value: '6' },
        w: { mathjs: 'BigNumber', value: '2' },
      },
      functions: { f: 'f(x) = w * x' },
    };

    expect(JSON.parse(JSON.stringify(parser, math.replacer))).toEqual(json);

    expect(() => {
      const external = new math.Parser();
      external.set('f', (x: number) => 2 * x);
      JSON.stringify(external, math.replacer);
    }).toThrow(/Cannot serialize external function f/);
  });

  it('revives Chain and Help with instanceof parity', () => {
    const chainJson = '{"mathjs":"Chain","value":2.3}';
    const revivedChain = JSON.parse(chainJson, math.reviver);
    expect(revivedChain).toBeInstanceOf(math.Chain);
    expect(revivedChain).toEqual(math.chain(2.3));

    const helpJson = '{"mathjs":"Help","name":"foo","description":"bar"}';
    const revivedHelp = JSON.parse(helpJson, math.reviver);
    expect(revivedHelp).toBeInstanceOf(math.Help);
    expect(revivedHelp).toEqual(new math.Help({ name: 'foo', description: 'bar' }));
  });

  it('revives Parser and evaluates serialized functions', () => {
    const json = JSON.stringify({
      mathjs: 'Parser',
      variables: {
        a: 42,
        c: { mathjs: 'BigNumber', value: '6' },
        w: { mathjs: 'BigNumber', value: '2' },
      },
      functions: { f: 'f(x) = w * x' },
    });

    const parser = JSON.parse(json, math.reviver);
    expect(parser.get('a')).toBe(42);
    expect(parser.get('c')).toEqual(math.bignumber('6'));
    expect(parser.get('w')).toEqual(math.bignumber('2'));
    expect(parser.evaluate('f(4)')).toEqual(math.bignumber('8'));
  });

  it('rejects unsafe variable names and non-object inputs in Parser.fromJSON', () => {
    const ParserCtor = math.Parser as unknown as { fromJSON: (input: unknown) => unknown };
    for (const bad of [null, undefined, 42, 'str', true, []]) {
      expect(() => ParserCtor.fromJSON(bad)).toThrow(TypeError);
    }

    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const payload = JSON.parse(`{"mathjs":"Parser","variables":{"${key}":{"polluted":true}}}`);
      expect(() => ParserCtor.fromJSON(payload)).toThrow(/Unsafe variable name/);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('revives Complex with the compat Complex prototype', () => {
    const revived = JSON.parse('{"mathjs":"Complex","re":2,"im":3}', math.reviver);
    expect(revived).toBeInstanceOf(math.Complex);
    expect(Object.getPrototypeOf(revived)).toBe(Object.getPrototypeOf(math.complex(2, 3)));
    expect(revived).toEqual(math.complex(2, 3));
  });

  it('keeps Help revival in sync after instance.import(...)', () => {
    const m = create(all);
    m.import({ customHelper1782: (x: number) => x + 1 });
    const revived = JSON.parse('{"mathjs":"Help","name":"foo","description":"bar"}', m.reviver);
    expect(revived).toBeInstanceOf(m.Help);
  });

  it('handles core Fraction, null receiver in replacer, and fallback classes in reviver', () => {
    expect(compatReplacer.call(null, 'k', 42)).toBe(42);
    const coreFracJson = JSON.stringify({ f: new CoreFraction(1, 3) }, math.replacer);
    expect(JSON.parse(coreFracJson)).toEqual({
      f: { mathjs: 'Fraction', n: '1', d: '3' },
    });

    const revivedBn = reviveInstanceValue('', { mathjs: 'BigNumber', value: '1.5' }, math.Unit, {});
    expect(revivedBn).toEqual(math.bignumber('1.5'));
  });
});
