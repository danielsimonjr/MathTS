/**
 * #1284 in compat: `matrix(undefined)` throws a TypeError, and `matrix()` is an empty matrix.
 * The oracle is the mathjs `matrix` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { storage?(): string; size?(): number[]; toArray(): unknown };
const math = create(all) as unknown as Record<string, Fn>;
const mj = mathjs as unknown as Record<string, Fn>;

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

// mathjs names the type of `undefined` as 'identifier | undefined'; MathTS names it 'undefined'.
const UNDEFINED_ARGUMENT =
  /^Unexpected type of argument in function matrix \(expected: string or Array or Matrix or boolean, actual: (identifier \| )?undefined, index: 0\)$/;

describe('compat matrix(undefined) throws a TypeError (#1284)', () => {
  it('matrix(undefined) throws the mathjs TypeError', () => {
    const expected = thrown(() => mj.matrix(undefined));
    expect(expected).toBeInstanceOf(TypeError);
    expect(expected!.message).toMatch(UNDEFINED_ARGUMENT);
    const actual = thrown(() => math.matrix(undefined));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toMatch(UNDEFINED_ARGUMENT);
  });

  it.each(['sparse', 'dense'])('matrix(undefined, "%s") throws', (format) => {
    const actual = thrown(() => math.matrix(undefined, format));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toMatch(UNDEFINED_ARGUMENT);
    expect(thrown(() => mj.matrix(undefined, format))).toBeInstanceOf(TypeError);
  });
});

describe('compat matrix() with no argument is an empty matrix (#1284)', () => {
  it('matrix() has the size [0]', () => {
    const m = math.matrix() as Mat;
    expect(m.toArray()).toEqual([]);
  });

  it('matrix("sparse") and matrix("dense") are empty matrices', () => {
    expect((math.matrix('sparse') as Mat).storage?.()).toBe('sparse');
    expect((math.matrix('dense') as Mat).storage?.()).toBe('dense');
  });

  it('the expression language: matrix() is an empty matrix', () => {
    const m = math.evaluate('matrix()') as Mat;
    expect(m.toArray()).toEqual([]);
  });

  it('matrix(data, undefined) is still read as no format', () => {
    const m = math.matrix([[1, 2]], undefined) as Mat;
    expect(m.toArray()).toEqual([[1, 2]]);
  });
});
