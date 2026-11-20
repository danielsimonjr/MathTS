/**
 * #1284: `matrix(undefined)`.
 *
 * `matrix(undefined)` returned an empty matrix. mathjs throws a TypeError for an explicit
 * `undefined` data argument and gives an empty matrix only for a call with no argument. The
 * oracle is the mathjs `matrix` of the mathjs devDependency.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Mat = { storage(): string; size(): number[]; toArray(): unknown };
const matrix = math.matrix as unknown as Fn;
const mjMatrix = mathjs.matrix as unknown as Fn;

function thrown(fn: () => unknown): Error | undefined {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  return undefined;
}

// mathjs names the type of `undefined` as 'identifier | undefined'; the bridge names it 'undefined'.
const UNDEFINED_ARGUMENT =
  /^Unexpected type of argument in function matrix \(expected: string or Array or Matrix or boolean, actual: (identifier \| )?undefined, index: 0\)$/;

describe('#1284 matrix(undefined) throws a TypeError', () => {
  it('matrix(undefined) throws the mathjs TypeError', () => {
    const expected = thrown(() => mjMatrix(undefined));
    expect(expected).toBeInstanceOf(TypeError);
    expect(expected!.message).toMatch(UNDEFINED_ARGUMENT);
    const actual = thrown(() => matrix(undefined));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toMatch(UNDEFINED_ARGUMENT);
  });

  it.each(['sparse', 'dense', 'default'])('matrix(undefined, "%s") throws', (format) => {
    const expected = thrown(() => mjMatrix(undefined, format));
    expect(expected).toBeInstanceOf(TypeError);
    expect(expected!.message).toMatch(UNDEFINED_ARGUMENT);
    const actual = thrown(() => matrix(undefined, format));
    expect(actual).toBeInstanceOf(TypeError);
    expect(actual!.message).toMatch(UNDEFINED_ARGUMENT);
  });

  it('a variable that is undefined throws, as an explicit undefined does', () => {
    const data = new Map<string, number[][]>().get('missing');
    expect(data).toBeUndefined();
    expect(thrown(() => matrix(data))).toBeInstanceOf(TypeError);
  });
});

describe('#1284 matrix() with no argument is an empty matrix', () => {
  it('matrix() is an empty dense matrix of size [0]', () => {
    const m = matrix() as Mat;
    expect(m.storage()).toBe('dense');
    expect(m.size()).toEqual([0]);
    expect((mjMatrix() as Mat).size()).toEqual([0]);
  });

  it('the format alone still gives an empty matrix of that format', () => {
    expect((matrix('sparse') as Mat).storage()).toBe('sparse');
    expect((matrix('dense') as Mat).storage()).toBe('dense');
    expect((matrix('default') as Mat).storage()).toBe('dense');
  });

  it('an explicit undefined format is still read as no format', () => {
    const m = matrix([[1]], undefined) as Mat;
    expect(m.storage()).toBe('dense');
    expect(m.toArray()).toEqual([[1]]);
  });
});
