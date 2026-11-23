/**
 * Entries of a nested array through the matrix decompositions that `@danielsimonjr/mathts-functions`
 * re-exports (code review F1 of batch A2). The matrix reader converts each entry by the implicit
 * rule of mathjs (`implicitNumber`, #1003): a string that is not a number throws the `Error` of the
 * typed conversion, an object throws a `TypeError`, and `true` and a numeric string convert.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Call = (a: unknown) => unknown;
const SURFACES: Record<string, Call> = {
  qrPivoted: math.qrPivoted as unknown as Call,
  svd: math.svd as unknown as Call,
  lq: math.lq as unknown as Call,
  rq: math.rq as unknown as Call,
  ql: math.ql as unknown as Call,
  eigvals: math.eigvals as unknown as Call,
  lstsq: (a) => (math.lstsq as unknown as (a: unknown, b: number[]) => unknown)(a, [1, 2]),
};

describe('F1: entries of the re-exported matrix decompositions', () => {
  describe.each(Object.entries(SURFACES))('%s', (_name, call) => {
    it("'a' throws the Error of the typed conversion", () => {
      expect(() =>
        call([
          [1, 'a'],
          [2, 3],
        ])
      ).toThrow(new Error('Cannot convert "a" to a number'));
    });

    it('{} throws a TypeError', () => {
      expect(() =>
        call([
          [1, {}],
          [2, 3],
        ])
      ).toThrow(TypeError);
    });

    it('true and a numeric string convert, as on the JS path', () => {
      expect(() =>
        call([
          [1, true],
          [2, 3],
        ])
      ).not.toThrow();
      expect(() =>
        call([
          [1, '2'],
          [2, 3],
        ])
      ).not.toThrow();
    });
  });

  it('qr (the typed JS path) throws the same Error for a string that is not a number', () => {
    expect(() =>
      math.qr([
        [1, 'a'],
        [2, 3],
      ] as never)
    ).toThrow(new Error('Cannot convert "a" to a number'));
  });
});
