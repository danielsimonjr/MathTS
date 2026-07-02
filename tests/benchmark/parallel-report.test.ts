import { describe, it, expect } from 'vitest';

import { buildBenchReport } from '../../tools/benchmark/parallel/report.js';
import type { OperationResult } from '../../tools/benchmark/parallel/harness.js';

const machine = { logicalCpus: 8, node: 'v26.3.0', arch: 'x64', platform: 'win32' };

function op(partial: Partial<OperationResult>): OperationResult {
  return {
    operation: 'x',
    category: 'c',
    sizeUnit: 'elements',
    sizes: [],
    breakEvenSize: null,
    ...partial,
  };
}

describe('buildBenchReport', () => {
  it('passes through the generated date and machine metadata verbatim', () => {
    const report = buildBenchReport([], { generated: '2026-07-02', machine });
    expect(report.generated).toBe('2026-07-02');
    expect(report.machine).toEqual(machine);
    expect(report.operations).toEqual([]);
  });

  it('recommends a numeric threshold in ELEMENTS for a matrix-dim break-even', () => {
    // matmul gates on rows*cols, so a break-even at dim 64 => 4096 elements.
    const matmul = op({ operation: 'matmul', sizeUnit: 'matrix dim', breakEvenSize: 64 });
    const report = buildBenchReport([matmul], { generated: 'd', machine });
    expect(report.operations[0].breakEvenElements).toBe(4096);
    expect(report.operations[0].recommendedThreshold).toBe(4096);
  });

  it('passes an elements-unit break-even through unchanged', () => {
    const erfc = op({ operation: 'erfc', sizeUnit: 'elements', breakEvenSize: 100_000 });
    const report = buildBenchReport([erfc], { generated: 'd', machine });
    expect(report.operations[0].recommendedThreshold).toBe(100_000);
  });

  it("recommends 'never' when the op never reaches a persistent break-even", () => {
    const add = op({ operation: 'add', sizeUnit: 'elements', breakEvenSize: null, note: 'no win' });
    const report = buildBenchReport([add], { generated: 'd', machine });
    expect(report.operations[0].breakEvenElements).toBeNull();
    expect(report.operations[0].recommendedThreshold).toBe('never');
    expect(report.operations[0].note).toBe('no win');
  });

  it('omits the note field when the operation has none', () => {
    const sqrt = op({ operation: 'sqrt', sizeUnit: 'elements', breakEvenSize: 50_000 });
    const report = buildBenchReport([sqrt], { generated: 'd', machine });
    expect('note' in report.operations[0]).toBe(false);
  });
});
