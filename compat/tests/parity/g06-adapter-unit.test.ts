import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';
import {
  compareMathjsFractionSign,
  createCompatCompare,
  createCompatBernoulli,
  createCompatPinv,
  type CompatBernoulliDependencies,
} from '../../src/mathjs-parity-g06.js';

describe('G06 adapter unit coverage', () => {
  const instance = create(all);

  it('compareMathjsFractionSign and createCompatCompare', () => {
    const f1 = instance.fraction(1, 3);
    const f2 = instance.fraction(2, 3);
    expect(compareMathjsFractionSign(f1, f2)).toBeLessThan(0);
    const cmp = createCompatCompare(instance.compare.bind(instance), (v) => v);
    expect(cmp(f1, f2)).toBeDefined();
    expect(cmp(1, 2)).toBe(-1);
  });

  it('createCompatPinv and createCompatBernoulli preserve types', () => {
    const pinv = createCompatPinv(instance.pinv.bind(instance), {
      convert: (v) => v,
      divide: instance.divide.bind(instance),
      equal: instance.equal.bind(instance),
      inv: instance.inv.bind(instance),
      deepEqual: instance.deepEqual.bind(instance),
      dotDivide: instance.dotDivide.bind(instance),
      dot: instance.dot.bind(instance),
      ctranspose: instance.ctranspose.bind(instance),
      multiply: instance.multiply.bind(instance),
      add: instance.add.bind(instance),
      matrix: (data, storage) => instance.matrix(data, storage),
      complex: instance.complex.bind(instance),
      isMatrix: instance.isMatrix.bind(instance),
    });
    expect(instance.isBigNumber(pinv(instance.bignumber(2)))).toBe(true);
    const bernDeps: CompatBernoulliDependencies = {
      convert: (v: unknown) => v,
      BigNumberClass: Object.getPrototypeOf(instance.bignumber(1)).constructor as CompatBernoulliDependencies['BigNumberClass'],
      FractionClass: Object.getPrototypeOf(instance.fraction(1, 2)).constructor as CompatBernoulliDependencies['FractionClass'],
      precision: () => 64,
    };
    const bern = createCompatBernoulli(instance.bernoulli.bind(instance), bernDeps);
    expect(bern(2)).toBeDefined();
  });
});