import { describe, it, expect } from 'vitest';
import { WorkbookExecutor } from '../src/executor.js';
import type { Workbook, WorkbookEvent } from '../src/types.js';

function makeWorkbook(
  cells: Workbook['cells'],
  execution: 'reactive' | 'sequential' | 'manual' = 'reactive'
): Workbook {
  return {
    version: '1.0',
    metadata: { title: 'Test' },
    runtime: { engine: 'mathts', execution },
    cells,
  };
}

describe('WorkbookExecutor - execution modes', () => {
  it('should NOT emit stale events in sequential mode', async () => {
    const wb = makeWorkbook(
      [
        { id: 'a', type: 'markdown', content: 'text' },
        { id: 'b', type: 'markdown', content: 'text2', dependsOn: ['a'] },
      ],
      'sequential'
    );
    const exec = new WorkbookExecutor(wb);
    const events: WorkbookEvent[] = [];
    exec.on((e) => events.push(e));
    await exec.runCell('a');
    expect(events.find((e) => e.type === 'cell:stale')).toBeUndefined();
  });

  it('should NOT emit stale events in manual mode', async () => {
    const wb = makeWorkbook(
      [
        { id: 'a', type: 'markdown', content: 'text' },
        { id: 'b', type: 'markdown', content: 'text2', dependsOn: ['a'] },
      ],
      'manual'
    );
    const exec = new WorkbookExecutor(wb);
    const events: WorkbookEvent[] = [];
    exec.on((e) => events.push(e));
    await exec.runCell('a');
    expect(events.find((e) => e.type === 'cell:stale')).toBeUndefined();
  });

  it('should run cells in topological order via runAll', async () => {
    const wb = makeWorkbook([
      { id: 'y', type: 'code', content: 'x * 2', dependsOn: ['x'] },
      { id: 'x', type: 'code', content: '21' },
    ]);
    const exec = new WorkbookExecutor(wb);
    await exec.runAll();
    expect(exec.getOutput('x')).toBe(21);
    expect(exec.getOutput('y')).toBe(42);
  });

  it('should propagate multiple dependency outputs into scope', async () => {
    const wb = makeWorkbook([
      { id: 'a', type: 'code', content: '4' },
      { id: 'b', type: 'code', content: '5' },
      { id: 'c', type: 'code', content: 'a + b', dependsOn: ['a', 'b'] },
    ]);
    const exec = new WorkbookExecutor(wb);
    await exec.runAll();
    expect(exec.getOutput('c')).toBe(9);
  });

  it('should skip undefined dependency outputs when building scope', async () => {
    // Cell c depends on b, but b has never been run -> its output is undefined
    // and must NOT be injected into scope. Referencing it should then fail.
    const wb = makeWorkbook([
      { id: 'b', type: 'code', content: '7' },
      { id: 'c', type: 'code', content: 'b + 1', dependsOn: ['b'] },
    ]);
    const exec = new WorkbookExecutor(wb);
    // Run c WITHOUT running b first.
    await expect(exec.runCell('c')).rejects.toThrow();
  });
});

describe('WorkbookExecutor - data cell YAML parsing', () => {
  it('should parse JSON-style object content', async () => {
    const wb = makeWorkbook([{ id: 'd', type: 'data', content: '{ a: 1, b: 2 }' }]);
    const exec = new WorkbookExecutor(wb);
    const result = await exec.runCell('d');
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should parse a YAML list', async () => {
    const wb = makeWorkbook([{ id: 'd', type: 'data', content: '- 1\n- 2\n- 3' }]);
    const exec = new WorkbookExecutor(wb);
    const result = await exec.runCell('d');
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('WorkbookExecutor - event ordering', () => {
  it('should emit start before success', async () => {
    const wb = makeWorkbook([{ id: 'a', type: 'code', content: '1 + 1' }]);
    const exec = new WorkbookExecutor(wb);
    const types: string[] = [];
    exec.on((e) => types.push(e.type));
    await exec.runCell('a');
    expect(types.indexOf('cell:start')).toBeLessThan(types.indexOf('cell:success'));
  });

  it('should emit start then error on failure (no success)', async () => {
    const wb = makeWorkbook([{ id: 'a', type: 'tensor', content: '' }]);
    const exec = new WorkbookExecutor(wb);
    const types: string[] = [];
    exec.on((e) => types.push(e.type));
    await exec.runCell('a').catch(() => {});
    expect(types).toContain('cell:start');
    expect(types).toContain('cell:error');
    expect(types).not.toContain('cell:success');
  });

  it('should support multiple subscribers and independent unsubscribe', async () => {
    const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: 'hi' }]);
    const exec = new WorkbookExecutor(wb);
    const a: WorkbookEvent[] = [];
    const b: WorkbookEvent[] = [];
    const unsubA = exec.on((e) => a.push(e));
    exec.on((e) => b.push(e));
    unsubA();
    await exec.runCell('a');
    expect(a).toHaveLength(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('calling unsubscribe twice should be safe', async () => {
    const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: 'hi' }]);
    const exec = new WorkbookExecutor(wb);
    const unsub = exec.on(() => {});
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});
