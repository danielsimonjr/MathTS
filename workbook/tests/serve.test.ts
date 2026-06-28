import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable, Writable } from 'node:stream';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runServer } from '../src/cli.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `srv-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-serveloop-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Feed NDJSON lines through the server loop; return parsed output objects. */
async function serve(lines: string[]): Promise<Array<Record<string, unknown>>> {
  const input = Readable.from(lines.map((l) => `${l}\n`));
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  await runServer(input, output);
  return chunks
    .join('')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe('runServer (stdio loop)', () => {
  it('processes requests in order and exits on shutdown', async () => {
    const p = fixture('cells:\n  - code: "2 + 3"\n    id: a');
    const out = await serve([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'open', params: { path: p } }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'run' }),
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'shutdown' }),
    ]);
    const responses = out.filter((o) => o.id !== undefined && !o.method);
    expect(responses.map((r) => r.id)).toEqual([1, 2, 3]); // strict order
    expect(out.some((o) => o.method === 'cell/event')).toBe(true); // streamed events
  });

  it('returns a parse error for a malformed line and keeps going', async () => {
    const p = fixture('cells:\n  - code: "1"\n    id: a');
    const out = await serve([
      'not json{',
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'open', params: { path: p } }),
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'shutdown' }),
    ]);
    expect(out.some((o) => (o.error as { code?: number })?.code === -32700)).toBe(true);
    // the loop survived: the subsequent open still responded
    expect(out.some((o) => o.id === 2 && o.result)).toBe(true);
  });

  it('rejects a batch (array) request', async () => {
    const out = await serve(['[]', JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'shutdown' })]);
    expect(out.some((o) => (o.error as { code?: number })?.code === -32600)).toBe(true);
  });

  it('ends cleanly on stdin EOF without a shutdown', async () => {
    const out = await serve([JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'capabilities' })]);
    expect(out.find((o) => o.id === 1)).toBeDefined();
  });
});
