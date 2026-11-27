/**
 * #1782 — JSON replacer/reviver round-trip for Parser, Chain, and Help.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

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
});
