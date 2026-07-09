import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `e-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-export-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const WB = [
  'metadata:',
  '  title: Demo',
  'cells:',
  '  - markdown: "# Hi"',
  '    id: m',
  '  - equation: "c = 1 / sqrt(a * b)"',
  '    id: eq',
  '  - code: "2 + 3"',
  '    id: x',
  '  - test: "x == 5"',
  '    id: t',
  '    depends_on: [x]',
].join('\n');

describe('mtsw export', () => {
  it('writes a self-contained HTML document to -o', async () => {
    const out = join(dir, 'out.html');
    const r = await dispatch(['export', fixture(WB), '-o', out]);
    expect(r.exitCode).toBe(0);
    const html = readFileSync(out, 'utf-8');
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>Demo</title>');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).toContain('<math'); // equation rendered to MathML
    expect(html).toContain('<mfrac>');
    expect(html).toContain('✓'); // passing test badge
    expect(html).not.toContain('<script'); // self-contained
  });

  it('prints HTML to stdout when no -o is given', async () => {
    const r = await dispatch(['export', fixture(WB)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('<math');
  });

  it('--json reports ok/bytes/path', async () => {
    const out = join(dir, 'j.html');
    const env = JSON.parse((await dispatch(['export', fixture(WB), '-o', out, '--json'])).stdout);
    expect(env.command).toBe('export');
    expect(env.ok).toBe(true);
    expect(env.data.bytes).toBeGreaterThan(0);
    expect(env.data.path).toBe(out);
  });

  it('rejects an unknown format', async () => {
    const r = await dispatch(['export', fixture(WB), '--format', 'bogus']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Unknown format');
  });

  it('--no-run still renders display-only equations', async () => {
    const r = await dispatch(['export', fixture(WB), '--no-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('<math');
  });

  it('fails on a dependency cycle instead of emitting an empty doc', async () => {
    const cyc = fixture(
      'cells:\n  - code: "b + 1"\n    id: a\n    depends_on: [b]\n  - code: "a + 1"\n    id: b\n    depends_on: [a]'
    );
    const r = await dispatch(['export', cyc]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toContain('cycle');
  });

  it('--no-run shows a never-run test as a neutral badge (not fail)', async () => {
    const p = fixture('cells:\n  - test: "1 == 1"\n    id: t');
    const r = await dispatch(['export', p, '--no-run']);
    expect(r.stdout).toContain('cell-test nrun');
  });

  it('renders a visualization cell as an inline SVG chart from dependency data', async () => {
    const p = fixture(
      [
        'cells:',
        '  - data: "[1, 2, 3]"',
        '    id: xs',
        '  - data: "[10, 20, 30]"',
        '    id: ys',
        '  - visualization: |',
        '      type: line',
        '      title: Demo Chart',
        '      x: { label: X, data: xs }',
        '      y: { label: Y, data: ys }',
        '    id: chart',
        '    depends_on: [xs, ys]',
      ].join('\n')
    );
    const r = await dispatch(['export', p]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('<svg');
    expect(r.stdout).toContain('<polyline');
    expect(r.stdout).toContain('Demo Chart');
  });
});
