import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

const { all, Chain, chain, create } = compat;

describe('MathJS chain constructors', () => {
  it('exports every MathJS module name also present on a full MathJS instance', () => {
    const upstream = oracle.create(oracle.all);
    const missing = Object.keys(upstream).filter(
      (name) => Object.hasOwn(oracle, name) && !Object.hasOwn(compat, name)
    );
    expect(missing).toEqual([]);
  });

  it('exports a constructor matching the named chain factory', () => {
    expect(chain(2)).toBeInstanceOf(Chain);
    const OracleChain = Reflect.get(oracle, 'Chain') as typeof Chain;
    expect(new Chain(2).add(3).done()).toBe(new OracleChain(2).add(3).done());
  });

  it('binds chain methods and constructor identity to the instance', () => {
    const math = create(all);
    const other = create(all);
    math.import({ twice: (x: number) => x * 2 });

    expect(math.chain(2)).toBeInstanceOf(math.Chain);
    expect(math.chain(2)).not.toBeInstanceOf(other.Chain);
    expect(new math.Chain(2).twice().done()).toBe(4);
  });
});
