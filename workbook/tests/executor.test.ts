import { describe, it, expect, vi } from 'vitest';
import { WorkbookExecutor, createExecutor } from '../src/executor.js';
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

describe('WorkbookExecutor', () => {
  describe('constructor', () => {
    it('should create executor from workbook', () => {
      const wb = makeWorkbook([]);
      const exec = new WorkbookExecutor(wb);
      expect(exec).toBeInstanceOf(WorkbookExecutor);
    });
  });

  describe('on()', () => {
    it('should subscribe to events', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: '# Hello' }]);
      const exec = new WorkbookExecutor(wb);
      const events: WorkbookEvent[] = [];
      exec.on((e) => events.push(e));
      await exec.runCell('a');
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].type).toBe('cell:start');
      expect(events[1].type).toBe('cell:success');
    });

    it('should return unsubscribe function', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: 'text' }]);
      const exec = new WorkbookExecutor(wb);
      const events: WorkbookEvent[] = [];
      const unsub = exec.on((e) => events.push(e));
      unsub();
      await exec.runCell('a');
      expect(events).toHaveLength(0);
    });
  });

  describe('runCell()', () => {
    it('should execute markdown cell and return content', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: '# Hello' }]);
      const exec = new WorkbookExecutor(wb);
      const result = await exec.runCell('a');
      expect(result).toBe('# Hello');
    });

    it('should execute data cell and return content', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'data', content: 'json-data' }]);
      const exec = new WorkbookExecutor(wb);
      const result = await exec.runCell('a');
      expect(result).toBe('json-data');
    });

    it('should execute code cell with simple expression', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'code', content: '2 + 3' }]);
      const exec = new WorkbookExecutor(wb);
      const result = await exec.runCell('a');
      expect(result).toBe(5);
    });

    it('should execute code cell with dependency scope', async () => {
      const wb = makeWorkbook([
        { id: 'x', type: 'code', content: '10' },
        { id: 'y', type: 'code', content: 'x * 2', dependsOn: ['x'] },
      ]);
      const exec = new WorkbookExecutor(wb);
      await exec.runCell('x');
      const result = await exec.runCell('y');
      expect(result).toBe(20);
    });

    it('should execute code cell with statement block', async () => {
      const wb = makeWorkbook([
        { id: 'a', type: 'code', content: 'const v = 3; return v * v;' },
      ]);
      const exec = new WorkbookExecutor(wb);
      const result = await exec.runCell('a');
      expect(result).toBe(9);
    });

    it('should throw for unknown cell id', async () => {
      const wb = makeWorkbook([]);
      const exec = new WorkbookExecutor(wb);
      await expect(exec.runCell('nonexistent')).rejects.toThrow('Cell not found: nonexistent');
    });

    it('should throw for unsupported cell type', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'tensor', content: '' }]);
      const exec = new WorkbookExecutor(wb);
      await expect(exec.runCell('a')).rejects.toThrow('Unsupported cell type: tensor');
    });

    it('should emit error event on failure', async () => {
      const wb = makeWorkbook([
        { id: 'a', type: 'code', content: 'throw new Error("deliberate")' },
      ]);
      const exec = new WorkbookExecutor(wb);
      const events: WorkbookEvent[] = [];
      exec.on((e) => events.push(e));
      await exec.runCell('a').catch(() => {});
      const errorEvent = events.find((e) => e.type === 'cell:error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.error).toContain('deliberate');
    });

    it('should mark dependents as stale in reactive mode', async () => {
      const wb = makeWorkbook(
        [
          { id: 'a', type: 'markdown', content: 'text' },
          { id: 'b', type: 'markdown', content: 'text2', dependsOn: ['a'] },
        ],
        'reactive'
      );
      const exec = new WorkbookExecutor(wb);
      const events: WorkbookEvent[] = [];
      exec.on((e) => events.push(e));
      await exec.runCell('a');
      const staleEvent = events.find((e) => e.type === 'cell:stale');
      expect(staleEvent).toBeDefined();
      expect(staleEvent!.cellId).toBe('b');
    });
  });

  describe('runAll()', () => {
    it('should run all cells and emit workbook:complete', async () => {
      const wb = makeWorkbook([
        { id: 'a', type: 'markdown', content: 'text' },
        { id: 'b', type: 'data', content: 'data' },
      ]);
      const exec = new WorkbookExecutor(wb);
      const events: WorkbookEvent[] = [];
      exec.on((e) => events.push(e));
      await exec.runAll();
      const completeEvent = events.find((e) => e.type === 'workbook:complete');
      expect(completeEvent).toBeDefined();
    });
  });

  describe('getOutput()', () => {
    it('should return stored output after cell execution', async () => {
      const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: 'hello' }]);
      const exec = new WorkbookExecutor(wb);
      await exec.runCell('a');
      expect(exec.getOutput('a')).toBe('hello');
    });

    it('should return undefined for unexecuted cell', () => {
      const wb = makeWorkbook([{ id: 'a', type: 'markdown', content: 'hello' }]);
      const exec = new WorkbookExecutor(wb);
      expect(exec.getOutput('a')).toBeUndefined();
    });
  });
});

describe('createExecutor', () => {
  it('should create a WorkbookExecutor instance', () => {
    const wb = makeWorkbook([]);
    const exec = createExecutor(wb);
    expect(exec).toBeInstanceOf(WorkbookExecutor);
  });
});
