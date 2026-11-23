/**
 * Issue #1151: the parameter list of a function was read with a regex that stops at the first ")".
 *
 * Sites that read a parameter list:
 *  - `validateClosureSource` (the closure guard of the worker fan-out),
 *  - `optimizeCallback` (map, forEach and filter of an Array),
 *  - the multi-array `map`,
 *  - `_adaptCallbackArity` of the Matrix bridge (the `map` and `forEach` methods of a Matrix and
 *    of a SparseMatrix, and so `evaluate`).
 *
 * Expected values come from the documented rest-parameter contract and from mathjs 15.2.0 (its
 * Matrix methods and `evaluate`). The mathjs function `map` has the same regex as MathTS and gives
 * [0, 0] for the `(a, b = (1), ...r)` form; the expected [1, 1] follows the contract and the
 * mathjs Matrix and `evaluate` paths.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, filter, forEach, map, matrix, sparse } from '../src/index.js';

/** The Matrix surface that these tests use: `matrix` and `sparse` are typed as returning `unknown`. */
interface Mat {
  map(callback: unknown): Mat;
  forEach(callback: unknown): void;
  toArray(): unknown[];
}
const mat = matrix as unknown as (data: unknown) => Mat;
const spr = sparse as unknown as (data: unknown) => Mat;
import { validateClosureSource } from '../src/typed/integration.js';

/** The array of a result: a Matrix gives its array, an Array stays. */
function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : (x as { toArray(): unknown[] }).toArray();
}

function rejects(source: string): string {
  try {
    validateClosureSource(source);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`validateClosureSource accepted: ${source}`);
}

describe('#1151 validateClosureSource: the parameter list', () => {
  it('accepts a parenthesised default before another parameter', () => {
    expect(() => validateClosureSource('(x=(1), y) => x+y')).not.toThrow();
    expect(() => validateClosureSource('function(x=(1+2), y){return x*y}')).not.toThrow();
    expect(() => validateClosureSource('(x, y=(1)) => x+y')).not.toThrow();
  });

  it('keeps the rejection of an outer name inside a default', () => {
    expect(rejects('(x=(outer), y) => x+y')).toContain('"outer"');
    expect(rejects('(x, y=(outer)) => x+y')).toContain('"outer"');
  });

  it('accepts a rest parameter, the own name of a function expression and a comment in the list', () => {
    expect(() => validateClosureSource('(...r) => r[0]')).not.toThrow();
    expect(() => validateClosureSource('(x, ...r) => x + r.length')).not.toThrow();
    expect(() => validateClosureSource('function f (x, y) { return x }')).not.toThrow();
    expect(() =>
      validateClosureSource('function f (x) { return x > 0 ? f(x - 1) : 0 }')
    ).not.toThrow();
    expect(() => validateClosureSource('(x /* ) */, y) => x+y')).not.toThrow();
  });

  it('rejects a destructured parameter with a clear message', () => {
    const msg = rejects('({a}) => a');
    expect(msg).toContain('workerCount fan-out');
    expect(msg).toMatch(/destructur/);
    expect(rejects('(x, [a, b]) => x')).toMatch(/destructur/);
  });

  it('rejects a source whose parameter list cannot be read', () => {
    expect(rejects('(x, y')).toMatch(/parameter list cannot be read/);
    expect(rejects('class A { constructor(x) {} }')).toMatch(/parameter list cannot be read/);
  });

  it('rejects a method, a getter and a generator: the worker cannot compile them', () => {
    expect(rejects('f(x){ return f(x) }')).toMatch(/arrow function or a function expression/);
    expect(rejects('get p(){ return 1 }')).toMatch(/arrow function or a function expression/);
    expect(rejects('function*(x){ return x }')).toMatch(/arrow function or a function expression/);
  });
});

describe('#1151 validateClosureSource: names that the worker does not have', () => {
  it('rejects this, super, import and export: the binding differs in the worker', () => {
    expect(rejects('(x) => this.k * x')).toContain('"this"');
    expect(rejects('function(x){ return this.k * x }')).toContain('"this"');
    expect(rejects('(x) => import.meta.url.length * x')).toContain('"import"');
    expect(rejects('(x) => x * super.k')).toContain('"super"');
  });

  it('rejects a spread of an outer name', () => {
    expect(rejects('(x) => Math.max(...outer)')).toContain('"outer"');
    expect(rejects('(x) => Math.max(x, ...outer)')).toContain('"outer"');
  });

  it('rejects from and as: they are ordinary names in a function body', () => {
    expect(rejects('(x) => x * from')).toContain('"from"');
    expect(rejects('(x) => x * as')).toContain('"as"');
  });

  it('reads a name with the Unicode rule and checks it like an ASCII name', () => {
    // A parameter or an allowed name is accepted in any script; an outer name is rejected.
    expect(() => validateClosureSource('(π) => π * 2')).not.toThrow();
    expect(() => validateClosureSource('(x, ünï = 1) => x * ünï')).not.toThrow();
    expect(rejects('(x) => x * π')).toContain('"π"');
    expect(rejects('(x) => x * ünï')).toContain('"ünï"');
    // The same name in ASCII is rejected for the same reason.
    expect(rejects('(x) => x * pi')).toContain('"pi"');
  });

  it('does not read the letters of a numeric literal as a name', () => {
    expect(() =>
      validateClosureSource('(x) => x * 1e5 + 0xFF + 0b11 + 0o17 + 10n * 1_000')
    ).not.toThrow();
  });

  it('accepts a spread of a literal, a property name and an optional chain', () => {
    expect(() => validateClosureSource('(x) => Math.max(...[x, 1])')).not.toThrow();
    expect(() => validateClosureSource('(x) => x?.toFixed')).not.toThrow();
    expect(() => validateClosureSource('(x) => x.toFixed(2).length')).not.toThrow();
  });

  it('keeps the rejection of arguments, a local declaration and an escaped name', () => {
    expect(rejects('(x) => x * arguments[0]')).toContain('"arguments"');
    expect(rejects('(x) => { const y = 2; return x * y }')).toContain('"y"');
    // A backslash, then u006fouter: the escape spells "outer" in the worker.
    expect(rejects('(x) => x * \\u006fouter')).toMatch(/outer-scope identifier/);
  });

  it('keeps the async rejection and the error prefix', () => {
    expect(rejects('async (x) => x')).toContain(
      'parallelGaussQuad/parallelRomberg workerCount fan-out:'
    );
    expect(rejects('(x) => outer')).toContain(
      'parallelGaussQuad/parallelRomberg workerCount fan-out:'
    );
  });
});

/**
 * A function made from its exact source text. A transpiler can drop a redundant parenthesis of a
 * default value (`b = (1)` becomes `b = 1`), and the reported defect needs the parenthesis in
 * `toString()`. `out` is visible to the source as `out`.
 */
function fromSource(source: string, out: unknown[] = []): never {
  return new Function('out', `return (${source})`)(out) as never;
}

describe('#1151 an Array callback: a rest parameter after a parenthesised default', () => {
  // length 1 (a stops the count at the first default); the rest parameter means "not unary".
  const restAfterDefault = '(a, b = (1), ...r) => r.length';

  it('map gives the index and the array: r holds one value (the array)', () => {
    expect(map([5, 6], fromSource(restAfterDefault))).toEqual([1, 1]);
  });

  it('map over two arrays gives r = [index, A, B]', () => {
    expect(map([5, 6], [7, 8], fromSource(restAfterDefault))).toEqual([3, 3]);
    // Guard: a rest parameter without a default.
    expect(map([5, 6], [7, 8], fromSource('(a, b, ...r) => r.length'))).toEqual([3, 3]);
  });

  it('forEach calls the callback with the index and the array', () => {
    const seen: unknown[] = [];
    forEach([5, 6], fromSource('(a, b = (1), ...r) => { out.push(r.length) }', seen));
    expect(seen).toEqual([1, 1]);
  });

  it('filter gives the index as an array to the callback', () => {
    // b is the index: an array on the Array path of filter. A number index gives [].
    expect(filter([5, 6], fromSource('(a, b = (1), ...r) => Array.isArray(b)'))).toEqual([5, 6]);
  });
});

describe('#1151 a Matrix callback: a rest parameter keeps every argument', () => {
  it('matrix.map: (a, ...r) gets index and matrix', () => {
    expect(arr(mat([5, 6]).map(fromSource('(a, ...r) => r.length')))).toEqual([2, 2]);
  });

  it('matrix.map: (a, b = (1), ...r) gets the index as b and the matrix in r', () => {
    expect(arr(mat([5, 6]).map(fromSource('(a, b = (1), ...r) => r.length')))).toEqual([1, 1]);
  });

  it('matrix.forEach: the same', () => {
    const seen: unknown[] = [];
    mat([5, 6]).forEach(fromSource('(a, b = (1), ...r) => { out.push(r.length) }', seen));
    expect(seen).toEqual([1, 1]);
  });

  it('map(matrix, cb) goes the same way', () => {
    expect(arr(map(mat([5, 6]), fromSource('(a, ...r) => r.length')))).toEqual([2, 2]);
  });

  it('evaluate passes the arguments of a scope function with a rest parameter', () => {
    const g = fromSource('(a, ...r) => r.length');
    const f = fromSource('(a, b = (1), ...r) => r.length');
    expect(arr(evaluate('map([5,6], g)', { g }))).toEqual([2, 2]);
    expect(arr(evaluate('map([5,6], f)', { f }))).toEqual([1, 1]);
  });

  it('SparseMatrix map and forEach read the rest parameter too', () => {
    const s = spr([
      [1, 0],
      [0, 4],
    ]);
    expect(String(arr(s.map(fromSource('(a, ...r) => r.length'))))).toBe('2,2,2,2');
    const seen: unknown[] = [];
    s.forEach(fromSource('(a, ...r) => { out.push(r.length) }', seen));
    expect(seen).toEqual([2, 2, 2, 2]);
  });
});

describe('#1151 D3: a Matrix callback with a default: the index goes to the defaulted parameter', () => {
  // mathjs 15.2.0: mat([5, 6]).map((a, s = 1 / 2) => a * s) is [0, 6] (a * index).
  it('matrix.map: (a, s = 1/2) receives the index as s', () => {
    expect(arr(mat([5, 6]).map(fromSource('(a, s = 1 / 2) => a * s')))).toEqual([0, 6]);
  });

  it('matrix.forEach: the same', () => {
    const seen: unknown[] = [];
    mat([5, 6]).forEach(fromSource('(a, s = 1 / 2) => { out.push(s) }', seen));
    expect(seen).toEqual([[0], [1]]);
  });

  it('map(matrix, cb) follows the Matrix method', () => {
    expect(arr(map(mat([5, 6]), fromSource('(a, s = 1 / 2) => a * s')))).toEqual([0, 6]);
  });

  it('a callback with three defaults gets all three arguments', () => {
    const f = fromSource('(a, b = 1, c = 2) => [typeof b, typeof c].join()');
    expect(arr(mat([5, 6]).map(f))).toEqual(['object,object', 'object,object']);
  });
});

describe('#1151 regression guards: what works today keeps its result', () => {
  it('map of an Array keeps a defaulted callback unary, as mathjs does', () => {
    expect(map([5, 6], fromSource('(a, s = 1 / 2) => a * s'))).toEqual([2.5, 3]);
    expect(map([5, 6], fromSource('(a, s = /x/) => String(s)'))).toEqual(['/x/', '/x/']);
  });

  it('a division and a regex literal in a default do not hide a rest parameter', () => {
    expect(map([5, 6], fromSource('(a, s = 1 / (2), ...r) => r.length'))).toEqual([1, 1]);
    expect(map([5, 6], fromSource(String.raw`(a, s = /\)/, ...r) => r.length`))).toEqual([1, 1]);
    expect(map([5, 6], fromSource('(a, s = b / c / (d), ...r) => r.length'))).toEqual([1, 1]);
  });

  it('a native function keeps its declared arity', () => {
    expect(map(['1', '4'], Number as never)).toEqual([1, 4]);
    expect(map([65], String.fromCharCode as never)).toEqual(['A']);
    expect(map([4], Math.sqrt as never)).toEqual([2]);
    expect(arr(mat([4, 9]).map(Math.sqrt as never))).toEqual([2, 3]);
  });

  it('a callback with two parameters gets the index as an array', () => {
    expect(arr(mat([5, 6]).map(fromSource('(a, b) => typeof b')))).toEqual(['object', 'object']);
  });

  it('map with a callback of one parameter gets one argument; a rest parameter gets index and array', () => {
    expect(map([1, 2, 3], ((x: number) => x * x) as never)).toEqual([1, 4, 9]);
    expect(map([5, 6], fromSource('(a, ...r) => r.length'))).toEqual([2, 2]);
  });
});
