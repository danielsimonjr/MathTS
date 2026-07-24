import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toIpynb } from '../src/ipynb.js';
import { dispatch, exportCommand } from '../src/cli.js';
import type { RenderDoc } from '../src/html.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `ipynb-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-ipynb-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const WB = [
  'metadata:',
  '  title: Demo',
  'cells:',
  '  - markdown: "# Hi\\nsome text"',
  '    id: m',
  '  - code: "2 + 3"',
  '    id: x',
  '  - test: "x == 5"',
  '    id: t',
  '    depends_on: [x]',
  '  - code: "nonexistentSymbol"',
  '    id: bad',
].join('\n');

interface RawCell {
  cell_type: string;
  source: unknown;
  metadata: unknown;
  execution_count?: unknown;
  outputs?: unknown[];
}
interface RawNotebook {
  nbformat: unknown;
  nbformat_minor: unknown;
  metadata: unknown;
  cells: RawCell[];
}

describe('toIpynb — nbformat v4 structural conformance', () => {
  function buildDoc(): RenderDoc {
    return {
      title: 'Demo',
      cells: [
        { type: 'markdown', content: '# Hi\nsome text' },
        { type: 'code', content: '2 + 3', id: 'x', output: '5' },
        { type: 'test', content: 'x == 5', id: 't', passed: true },
        {
          type: 'code',
          content: 'nonexistentSymbol',
          id: 'bad',
          error: 'Undefined symbol "nonexistentSymbol"',
        },
      ],
    };
  }

  it('(a) parses as JSON', () => {
    const text = toIpynb(buildDoc());
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('(b) has valid top-level nbformat v4 structure', () => {
    const nb = JSON.parse(toIpynb(buildDoc())) as RawNotebook;
    expect(nb.nbformat).toBe(4);
    expect(Number.isInteger(nb.nbformat_minor)).toBe(true);
    expect(nb.nbformat_minor as number).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(nb.cells)).toBe(true);
    expect(nb.metadata).toBeTypeOf('object');
    expect(nb.metadata).not.toBeNull();
  });

  it('(c) every cell has a valid cell_type, array source, and code cells carry outputs+execution_count', () => {
    const nb = JSON.parse(toIpynb(buildDoc())) as RawNotebook;
    expect(nb.cells.length).toBe(4);
    for (const cell of nb.cells) {
      expect(['code', 'markdown', 'raw']).toContain(cell.cell_type);
      expect(Array.isArray(cell.source)).toBe(true);
      for (const line of cell.source as unknown[]) expect(typeof line).toBe('string');
      if (cell.cell_type === 'code') {
        expect(Array.isArray(cell.outputs)).toBe(true);
        expect('execution_count' in cell).toBe(true);
      }
    }
  });

  it('(d) a code cell with a result has an execute_result output containing the formatted value', () => {
    const nb = JSON.parse(toIpynb(buildDoc())) as RawNotebook;
    const xCell = nb.cells[1];
    expect(xCell.cell_type).toBe('code');
    const outputs = xCell.outputs as Array<Record<string, unknown>>;
    const execResult = outputs.find((o) => o.output_type === 'execute_result');
    expect(execResult).toBeDefined();
    const data = execResult!.data as Record<string, string[]>;
    expect(data['text/plain'].join('')).toContain('5');
    expect(execResult!.execution_count).toBeTypeOf('number');
  });

  it('an errored code cell has an error output', () => {
    const nb = JSON.parse(toIpynb(buildDoc())) as RawNotebook;
    const badCell = nb.cells[3];
    expect(badCell.cell_type).toBe('code');
    const outputs = badCell.outputs as Array<Record<string, unknown>>;
    const err = outputs.find((o) => o.output_type === 'error');
    expect(err).toBeDefined();
    expect(err!.evalue).toContain('Undefined symbol');
  });

  it('a markdown cell has no outputs/execution_count keys', () => {
    const nb = JSON.parse(toIpynb(buildDoc())) as RawNotebook;
    const mdCell = nb.cells[0];
    expect(mdCell.cell_type).toBe('markdown');
    expect(mdCell.outputs).toBeUndefined();
    expect(mdCell.execution_count).toBeUndefined();
  });

  it('(e) round-trips through JSON.parse(JSON.stringify(...))', () => {
    const nb = JSON.parse(toIpynb(buildDoc()));
    expect(JSON.parse(JSON.stringify(nb))).toEqual(nb);
  });
});

describe('mtsw export --format ipynb', () => {
  it('emits a structurally valid nbformat v4 document to stdout', async () => {
    const r = await exportCommand([fixture(WB), '--format', 'ipynb']);
    expect(r.exitCode).toBe(0);
    const nb = JSON.parse(r.stdout) as RawNotebook;
    expect(nb.nbformat).toBe(4);
    expect(nb.cells.length).toBe(4);
  });

  it('writes a valid .ipynb file to -o', async () => {
    const out = join(dir, 'out.ipynb');
    const r = await dispatch(['export', fixture(WB), '--format', 'ipynb', '-o', out]);
    expect(r.exitCode).toBe(0);
    const nb = JSON.parse(readFileSync(out, 'utf-8')) as RawNotebook;
    expect(nb.nbformat).toBe(4);
    const codeCells = nb.cells.filter((c) => c.cell_type === 'code');
    expect(codeCells.length).toBeGreaterThan(0);
    // The passing test cell renders as an execute_result of "true".
    const testCell = nb.cells.find(
      (c) => Array.isArray(c.source) && (c.source as string[]).join('').includes('x == 5')
    )!;
    const outputs = testCell.outputs as Array<Record<string, unknown>>;
    expect(outputs.some((o) => o.output_type === 'execute_result')).toBe(true);
    // The failing (undefined symbol) code cell renders as an error output.
    const badCell = nb.cells.find(
      (c) =>
        Array.isArray(c.source) && (c.source as string[]).join('').includes('nonexistentSymbol')
    )!;
    const badOutputs = badCell.outputs as Array<Record<string, unknown>>;
    expect(badOutputs.some((o) => o.output_type === 'error')).toBe(true);
  });

  it('--json reports ok/bytes/path', async () => {
    const out = join(dir, 'j.ipynb');
    const env = JSON.parse(
      (await dispatch(['export', fixture(WB), '--format', 'ipynb', '-o', out, '--json'])).stdout
    );
    expect(env.command).toBe('export');
    expect(env.ok).toBe(true);
    expect(env.data.bytes).toBeGreaterThan(0);
    expect(env.data.path).toBe(out);
  });

  it('rejects an unknown format (ipynb accepted, bogus rejected)', async () => {
    const ok = await exportCommand([fixture(WB), '--format', 'ipynb', '--no-run']);
    expect(ok.exitCode).toBe(0);
    const bad = await exportCommand([fixture(WB), '--format', 'bogus']);
    expect(bad.exitCode).toBe(1);
    expect(bad.stderr).toMatch(/ipynb/);
  });
});
