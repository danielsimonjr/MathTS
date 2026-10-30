import { describe, expect, it, vi } from 'vitest';
import { createScalarBuilder } from '@danielsimonjr/mathts-expression';
import { compileScalar } from '../src/scalar-compile.js';
import {
  evaluateScalarPopulation,
  SCALAR_PARALLEL_MIN_ROWS,
} from '../src/scalar-batch-parallel.js';

describe('evaluateScalarPopulation', () => {
  const scalar = createScalarBuilder();
  const node = scalar.op('+', [
    scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]),
    scalar.symbol('x'),
  ]);

  function makeColumns(n: number): Float64Array[] {
    const col = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      col[i] = -1 + (2 * i) / Math.max(1, n - 1);
    }
    return [col];
  }

  it('exports threshold 100 from benchmark citation', () => {
    expect(SCALAR_PARALLEL_MIN_ROWS).toBe(100);
  });

  it('does not call pool.execute below threshold', async () => {
    const columns = makeColumns(99);
    const compiled = compileScalar(node, { variables: ['x'] });
    const reference = compiled.evaluate(columns);

    const execute = vi.fn();
    const pool = { execute };

    const results = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [{ index: 0, node }],
      parallel: { pool, timeoutMs: 30_000 },
    });

    expect(execute).not.toHaveBeenCalled();
    expect([...results[0]!.batch.values]).toEqual([...reference.values]);
    expect([...results[0]!.batch.valid]).toEqual([...reference.valid]);
  });

  it('calls pool.execute with timeout at threshold', async () => {
    const columns = makeColumns(100);
    const compiled = compileScalar(node, { variables: ['x'] });
    const reference = compiled.evaluate(columns);

    const execute = vi.fn(
      async (_payload: unknown, _transfer?: Transferable[], timeoutMs?: number) => {
        expect(timeoutMs).toBe(30_000);
        const payload = _payload as {
          items: { candidateIndex: number }[];
          columns: Float64Array[];
          variables: string[];
        };
        const rows = payload.items.map((item) => {
          const batch = compileScalar(node, { variables: ['x'] }).evaluate(payload.columns);
          return {
            candidateIndex: item.candidateIndex,
            values: batch.values,
            valid: batch.valid,
            allValid: batch.allValid,
          };
        });
        return { rows };
      }
    ) as Pick<import('@danielsimonjr/mathts-parallel').WorkerPool, 'execute'>['execute'];

    const results = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [{ index: 0, node }],
      parallel: { pool: { execute }, timeoutMs: 30_000 },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect([...results[0]!.batch.values]).toEqual([...reference.values]);
    expect([...results[0]!.batch.valid]).toEqual([...reference.valid]);
  });
});
