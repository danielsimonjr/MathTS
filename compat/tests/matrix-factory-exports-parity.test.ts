import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { atan2Dependencies, create, matrixDependencies } from '../src/index.js';

type MatrixCall = (...args: unknown[]) => {
  size(): number[];
  valueOf(): unknown;
  storage(): string;
  datatype(): string;
};

function upstream(name: string) {
  const bundle = Reflect.get(oracle, name) as Parameters<typeof oracle.create>[0];
  return oracle.create({ [name]: bundle } as typeof bundle);
}

describe('native matrix factory bundles', () => {
  it('matches matrix shape, data, and storage using only compat imports', () => {
    const actual = create({ matrixDependencies });
    const expected = upstream('matrixDependencies');
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const format of ['dense', 'sparse'] as const) {
      const data = [
        [1, 0],
        [0, 2],
      ];
      const actualMatrix = actual.matrix as unknown as MatrixCall;
      const expectedMatrix = expected.matrix as unknown as MatrixCall;
      const result = actualMatrix(data, format, 'number');
      const reference = expectedMatrix(data, format, 'number');
      expect(result.size()).toEqual(reference.size());
      expect(result.valueOf()).toEqual(reference.valueOf());
      expect(result.storage()).toBe(reference.storage());
      expect(result.datatype()).toBe(reference.datatype());
      expect(actualMatrix(format, 'number').size()).toEqual(
        expectedMatrix(format, 'number').size()
      );
    }
  });

  it('loads the transitive dependencies for atan2', () => {
    const actual = create({ atan2Dependencies });
    const expected = upstream('atan2Dependencies');
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    expect(actual.atan2(1, -1)).toBeCloseTo(expected.atan2(1, -1), 14);
    expect(actual.concat([1], [2])).toEqual(expected.concat([1], [2]));
    const y = [1, 0];
    const x = [0, 1];
    const actualAtan2 = actual.atan2 as (y: unknown, x: unknown) => unknown;
    const expectedAtan2 = expected.atan2 as (y: unknown, x: unknown) => unknown;
    expect(actualAtan2(y, x)).toEqual(expectedAtan2(y, x));
  });
});
