import { describe, it, expect } from 'vitest';
import { WorkbookExecutor } from '../src/executor.js';
import type { Workbook } from '../src/types.js';

function makeWorkbook(
  cells: Workbook['cells'],
  execution: 'reactive' | 'sequential' | 'manual' = 'sequential'
): Workbook {
  return {
    version: '1.0',
    metadata: { title: 'Test' },
    runtime: { engine: 'mathts', execution },
    cells,
  };
}

describe('WorkbookExecutor - test cells', () => {
  it('should mark a passing assertion as pass', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '5' },
      { id: 'checkA', type: 'test', content: 'a == 5', dependsOn: ['a'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    const check = report.cells.find((c) => c.id === 'checkA')!;
    expect(check.status).toBe('pass');
    expect(report.ok).toBe(true);
  });

  it('should mark a failing assertion as fail with a safe message (no content leak)', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '5' },
      { id: 'checkA', type: 'test', content: 'a == 999', dependsOn: ['a'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    const check = report.cells.find((c) => c.id === 'checkA')!;
    expect(check.status).toBe('fail');
    expect(check.error).toBe("Assertion failed in cell 'checkA'");
    expect(check.error).not.toContain('999'); // content must not leak into the message
    expect(report.ok).toBe(false);
  });

  it('should mark a non-boolean test result as error', async () => {
    const wb = makeWorkbook([{ id: 'badTest', type: 'test', content: '2 + 3' }]);
    const report = await new WorkbookExecutor(wb).runReport();
    const check = report.cells.find((c) => c.id === 'badTest')!;
    expect(check.status).toBe('error');
    expect(check.error).toContain('must evaluate to a boolean');
    expect(report.ok).toBe(false);
  });
});

describe('WorkbookExecutor - runReport', () => {
  it('should continue past a failing cell and report all cells', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '1' },
      { id: 'bad', type: 'code', content: 'nonexistentSymbol' },
      { id: 'c', type: 'code', content: 'a + 1', dependsOn: ['a'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    expect(report.cells).toHaveLength(3);
    expect(report.cells.find((c) => c.id === 'a')!.status).toBe('success');
    expect(report.cells.find((c) => c.id === 'bad')!.status).toBe('error');
    expect(report.cells.find((c) => c.id === 'c')!.status).toBe('success');
    expect(report.cells.find((c) => c.id === 'c')!.output).toBe(2);
    expect(report.ok).toBe(false);
  });

  it('should refuse to run a workbook with a dependency cycle', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: 'b', dependsOn: ['b'] },
      { id: 'b', type: 'code', content: 'a', dependsOn: ['a'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    expect(report.ok).toBe(false);
    expect(report.cells.some((c) => c.status === 'error' && /cycle/i.test(c.error ?? ''))).toBe(
      true
    );
  });

  it('should NOT inject transitive dependencies into scope', async () => {
    // c depends only on b; it references `a`, which is b's dependency, not c's.
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '10' },
      { id: 'b', type: 'code', content: 'a * 2', dependsOn: ['a'] },
      { id: 'c', type: 'code', content: 'a + 1', dependsOn: ['b'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    expect(report.cells.find((c) => c.id === 'a')!.status).toBe('success');
    expect(report.cells.find((c) => c.id === 'b')!.status).toBe('success');
    expect(report.cells.find((c) => c.id === 'c')!.status).toBe('error');
    expect(report.ok).toBe(false);
  });

  it('should reject a data cell whose payload contains a prototype-pollution key', async () => {
    const wb = makeWorkbook([{ id: 'd', type: 'data', content: 'constructor: evil' }]);
    const report = await new WorkbookExecutor(wb).runReport();
    const cell = report.cells.find((c) => c.id === 'd')!;
    expect(cell.status).toBe('error');
    expect(cell.error?.toLowerCase()).toContain('prototype pollution');
    expect(report.ok).toBe(false);
  });

  it('should expose multiple named values via an object literal + property access', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '{ n: 2, m: 3 }' },
      { id: 'b', type: 'code', content: 'a.n + a.m', dependsOn: ['a'] },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    expect(report.cells.find((c) => c.id === 'b')!.status).toBe('success');
    expect(report.cells.find((c) => c.id === 'b')!.output).toBe(5);
    expect(report.ok).toBe(true);
  });
});

describe('WorkbookExecutor - runReport({ only })', () => {
  it('runs only the target cell and its transitive dependencies', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '10' },
      { id: 'b', type: 'code', content: 'a * 2', dependsOn: ['a'] },
      { id: 'unrelated', type: 'code', content: '999' },
    ]);
    const report = await new WorkbookExecutor(wb).runReport({ only: 'b' });
    const ids = report.cells.map((c) => c.id).sort();
    expect(ids).toEqual(['a', 'b']);
    expect(report.cells.find((c) => c.id === 'unrelated')).toBeUndefined();
    expect(report.cells.find((c) => c.id === 'b')!.output).toBe(20);
    expect(report.ok).toBe(true);
  });

  it('runs everything when no target is given (back-compat)', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '1' },
      { id: 'b', type: 'code', content: '2' },
    ]);
    const report = await new WorkbookExecutor(wb).runReport();
    expect(report.cells.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });
});
