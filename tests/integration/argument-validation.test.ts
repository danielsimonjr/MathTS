import { describe, expect, it } from 'vitest';
import * as f from '@danielsimonjr/mathts-functions';
import * as e from '@danielsimonjr/mathts-expression';
import { getMaxMatrixSize } from '@danielsimonjr/mathts-gpu';
import { computePool, parallelMean } from '@danielsimonjr/mathts-parallel';
import { gather, roll, Tensor } from '@danielsimonjr/mathts-tensor';
import { grad } from '@danielsimonjr/mathts-autograd';
import { runWorkbookWithTimeout } from '@danielsimonjr/mathts-workbook';

describe('reported invalid runtime arguments (#1008, #1009)', () => {
  it('names missing vectors, tensor inputs, GPU capabilities and expression nodes', () => {
    expect(() => f.linregress([1, 2, 3], undefined as never)).toThrow(/linregress y.*array/);
    expect(() => gather(1 as never, 0, [0])).toThrow(/gather.*Tensor/);
    expect(() => getMaxMatrixSize(undefined as never)).toThrow(/getMaxMatrixSize.*capabilities/);
    expect(() => e.getPrecedence('*')).toThrow(/getPrecedence.*Node/);
    expect(() => f.compileExpr('x + 1').evaluate()).toThrow(/Undefined symbol "x"/);
    expect(() => e.compile(e.parse('x + 1'), undefined as never)).toThrow(/compile.*math scope/);
  });

  it('surfaces invalid values before numerical or symbolic processing', async () => {
    expect(() => f.compileExpr('x').evaluate({ x: undefined })).toThrow(/Undefined symbol "x"/);
    expect(() => f.derivativeAt(((x: number) => x * x * x) as never, 2)).toThrow(
      /derivativeAt.*Dual/
    );
    expect(() => f.realRoots([1, NaN, 1])).toThrow(/coefficient at index 1.*finite/);
    expect(f.quad(() => NaN, 0, 1).converged).toBe(false);
    expect(() =>
      f.lusolve(
        [
          [2, 0],
          [0, 2],
        ],
        [Infinity, 2]
      )
    ).toThrow(/lusolve.*right-hand side.*finite/);
    await expect(parallelMean('abc' as never)).rejects.toThrow(TypeError);
    expect(() => e.scalarSymbols('x+y*x' as never)).toThrow(/ScalarNode/);
    expect(() => e.scalarComplexity('x+1' as never)).toThrow(/ScalarNode/);
  });
});

describe('reported misleading diagnostics (#1012)', () => {
  it('bounds undefined-symbol diagnostics for large inputs and guides users of the AST compiler', () => {
    expect(() => f.evaluate('a'.repeat(1_000_000))).toThrow(/^Undefined symbol "[a]{100}…"$/);
    expect(() => e.compile('2+3' as never, {})).toThrow(/compileExpression/);
    expect(e.compileExpression('2+3').evaluate()).toBe(5);
  });

  it('handles numeric roll axes and negative gather indices', () => {
    const data = new Tensor([2, 3], Float64Array.of(1, 2, 3, 4, 5, 6));
    expect(() => data.reshape([5, 3])).toThrow(/\[2,3\] -> \[5,3\]/);
    expect(Array.from(gather(data, 1, [-1, 0]).data)).toEqual([3, 1, 6, 4]);
    expect(Array.from(roll(data, 1, 1).data)).toEqual([3, 1, 2, 6, 4, 5]);
  });

  it('distinguishes invalid coefficients, a missing variable and bad functions', async () => {
    expect(() =>
      f.lusolve(
        [
          [2, NaN],
          [0, 2],
        ],
        [1, 2]
      )
    ).toThrow(/coefficient matrix.*finite/);
    await expect(runWorkbookWithTimeout('a: 1', {} as never)).rejects.toThrow(/timeoutMs/);
    await expect(computePool.unary(Float64Array.of(1), 'cbrt' as never)).rejects.toThrow(
      /unary.*kernel/
    );
    expect(f.pinv([])).toEqual([]);
    expect(() => f.realRoots([])).toThrow(/non-empty array of polynomial coefficients/);
    expect(() => f.solve('x^3-8', 'y')).toThrow(/requested variable "y"/);
    expect(() => grad('abc' as never)).toThrow(/grad.*expected a function/);
  });
});
