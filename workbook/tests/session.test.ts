import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session } from '../src/session.js';

let dir: string;
let counter = 0;

function fixture(content: string): string {
  const path = join(dir, `s-${counter++}.mtsw`);
  writeFileSync(path, content, 'utf-8');
  return path;
}

/** ids that emitted a cell:start in a run (i.e. were actually executed). */
function executed(events: { type: string; cellId?: string }[]): string[] {
  return events.filter((e) => e.type === 'cell:start').map((e) => e.cellId!);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-session-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// a -> {b, c}: b and c both depend on a; nothing depends on b or c.
const FORK = [
  'cells:',
  '  - code: "10"',
  '    id: a',
  '  - code: "a + 1"',
  '    id: b',
  '    depends_on: [a]',
  '  - code: "a + 2"',
  '    id: c',
  '    depends_on: [a]',
].join('\n');

describe('Session', () => {
  it('opens a workbook and marks every cell stale', () => {
    const s = new Session();
    s.open(fixture(FORK));
    expect(s.staleIds().sort()).toEqual(['a', 'b', 'c']);
  });

  it('runs everything on the first run', async () => {
    const s = new Session();
    s.open(fixture(FORK));
    const { result, events } = await s.run();
    expect(result.ok).toBe(true);
    expect(executed(events).sort()).toEqual(['a', 'b', 'c']);
    expect(result.cells.find((c) => c.id === 'b')!.output).toBe(11);
    expect(s.staleIds()).toEqual([]);
  });

  it('re-runs ONLY the edited leaf cell (incremental)', async () => {
    const s = new Session();
    s.open(fixture(FORK));
    await s.run(); // warm the cache

    s.editCell('b', { content: 'a + 100' }); // b is a leaf (nothing depends on b)
    expect(s.staleIds()).toEqual(['b']);

    const { result, events } = await s.run();
    expect(executed(events)).toEqual(['b']); // a and c NOT re-run
    expect(result.cells.find((c) => c.id === 'b')!.output).toBe(110);
    expect(result.ok).toBe(true);
  });

  it('re-runs a cell AND its dependents when a shared dependency changes', async () => {
    const s = new Session();
    s.open(fixture(FORK));
    await s.run();

    s.editCell('a', { content: '20' }); // a feeds b and c
    expect(s.staleIds().sort()).toEqual(['a', 'b', 'c']);

    const { events } = await s.run();
    expect(executed(events).sort()).toEqual(['a', 'b', 'c']);
  });

  it('treats a reorder as not-stale (move re-runs nothing)', async () => {
    const s = new Session();
    s.open(fixture(FORK));
    await s.run();
    s.moveCell('c', { at: 0 });
    expect(s.staleIds()).toEqual([]);
    const { events } = await s.run();
    expect(executed(events)).toEqual([]);
  });

  it('keeps an errored cell stale so it is retried on the next run', async () => {
    const s = new Session();
    s.open(fixture('cells:\n  - code: "nosuchsymbol"\n    id: a'));
    const r1 = await s.run();
    expect(r1.result.cells.find((c) => c.id === 'a')!.status).toBe('error');
    expect(s.staleIds()).toContain('a'); // not cleared despite "running"
    const { events } = await s.run();
    expect(executed(events)).toContain('a'); // retried, not skipped
  });

  it('keeps an errored cell stale even after an UNRELATED edit', async () => {
    // a errors; b is independent and succeeds. Editing b must not "un-stale" a.
    const s = new Session();
    s.open(fixture('cells:\n  - code: "nosuchsymbol"\n    id: a\n  - code: "1"\n    id: b'));
    await s.run();
    expect(s.staleIds()).toContain('a');
    s.editCell('b', { content: '2' }); // unrelated to a
    expect(s.staleIds()).toContain('a'); // still stale (cache != valid)
    const { events } = await s.run();
    expect(executed(events)).toContain('a'); // a retried, not silently skipped
  });

  it('refuses to open over unsaved edits unless forced; save persists them', () => {
    const path = fixture(FORK);
    const s = new Session();
    s.open(path);
    s.editCell('a', { content: '99' });
    expect(s.dirty).toBe(true);
    expect(() => s.open(path)).toThrow(/unsaved/i);
    s.save();
    expect(s.dirty).toBe(false);
    expect(readFileSync(path, 'utf-8')).toContain('99');
  });
});
