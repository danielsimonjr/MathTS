import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session } from '../src/session.js';
import { handleRequest } from '../src/rpc.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `r-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-rpc-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const WB = 'cells:\n  - code: "10"\n    id: a\n  - code: "a + 1"\n    id: b\n    depends_on: [a]';

function call(session: Session, method: string, params?: Record<string, unknown>, id: number | string | null = 1) {
  return handleRequest(session, { jsonrpc: '2.0', id, method, params });
}

// Loose result/error views to keep the tests readable without `any`.
type RunRes = { ok: boolean; cells: Array<{ id: string; output?: unknown }> };
type DocRes = { cells: Array<{ id: string }>; path?: string };

describe('handleRequest (JSON-RPC router)', () => {
  it('open returns the describe doc + path and echoes the id', async () => {
    const s = new Session();
    const r = await call(s, 'open', { path: fixture(WB) });
    expect(r.response.id).toBe(1);
    const res = r.response.result as DocRes;
    expect(res.cells.map((c) => c.id)).toEqual(['a', 'b']);
    expect(res.path).toBeDefined();
  });

  it('run streams cell/event notifications and returns a RunResult', async () => {
    const s = new Session();
    await call(s, 'open', { path: fixture(WB) });
    const r = await call(s, 'run');
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.every((e) => e.method === 'cell/event')).toBe(true);
    const res = r.response.result as RunRes;
    expect(res.ok).toBe(true);
    expect(res.cells.find((c) => c.id === 'b')!.output).toBe(11);
  });

  it('cell/edit then run re-runs incrementally (only the edited leaf)', async () => {
    const s = new Session();
    await call(s, 'open', { path: fixture(WB) });
    await call(s, 'run');
    await call(s, 'cell/edit', { id: 'b', content: 'a + 100' });
    const r = await call(s, 'run');
    const started = r.events.filter((e) => e.params.type === 'cell:start').map((e) => e.params.cellId);
    expect(started).toEqual(['b']);
  });

  it('maps errors to JSON-RPC codes and survives', async () => {
    const s = new Session();
    expect((await call(s, 'nope')).response.error?.code).toBe(-32601); // method not found
    const bad = await handleRequest(s, { jsonrpc: '2.0', id: 5 }); // no method
    expect(bad.response.error?.code).toBe(-32600);
    expect(bad.response.id).toBe(5);

    await call(s, 'open', { path: fixture(WB) });
    const dup = await call(s, 'cell/add', { id: 'a', type: 'code', content: '1' }); // duplicate id
    expect(dup.response.error?.code).toBe(-32603);
    expect(dup.response.error?.message).toMatch(/[Dd]uplicate/);
  });

  it('save persists edits; shutdown signals stop', async () => {
    const p = fixture(WB);
    const s = new Session();
    await call(s, 'open', { path: p });
    await call(s, 'cell/edit', { id: 'a', content: '42' });
    const saved = await call(s, 'save');
    expect((saved.response.result as { path: string }).path).toBeDefined();
    expect(readFileSync(p, 'utf-8')).toContain('42');
    expect((await call(s, 'shutdown')).shutdown).toBe(true);
  });

  it('capabilities/functions are answerable over rpc', async () => {
    const s = new Session();
    const caps = (await call(s, 'capabilities')).response.result as { features: Record<string, boolean> };
    expect(caps.features.serve).toBe(true);
    const fns = (await call(s, 'functions')).response.result as { functions: string[] };
    expect(fns.functions.length).toBeGreaterThan(0);
  });

  it('open refuses over unsaved edits unless forced', async () => {
    const s = new Session();
    await call(s, 'open', { path: fixture(WB) });
    await call(s, 'cell/edit', { id: 'a', content: '5' });
    expect((await call(s, 'open', { path: fixture(WB) })).response.error?.code).toBe(-32603);
    expect((await call(s, 'open', { path: fixture(WB), force: true })).response.result).toBeDefined();
  });
});
