import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `a-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
function file(name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-authoring-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('mtsw new (templates + -o path)', () => {
  it('--empty creates a blank workbook at an -o path', async () => {
    const out = join(dir, 'empty.mtsw');
    const r = await dispatch(['new', '--empty', '-o', out]);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(out, 'utf-8')).toContain('cells: []');
  });

  it('-t chart scaffolds a working visualization workbook', async () => {
    const out = join(dir, 'chart.mtsw');
    expect((await dispatch(['new', '-t', 'chart', '-o', out])).exitCode).toBe(0);
    const c = readFileSync(out, 'utf-8');
    expect(c).toContain('visualization');
    expect((await dispatch(['validate', out])).exitCode).toBe(0); // a valid chart spec
  });

  it('-o accepts an explicit path (not just CWD) and appends .mtsw', async () => {
    const out = join(dir, 'noext');
    expect((await dispatch(['new', '--empty', '-o', out])).exitCode).toBe(0);
    expect(readFileSync(`${out}.mtsw`, 'utf-8')).toContain('cells: []');
  });
});

describe('mtsw import', () => {
  const DOC = JSON.stringify({
    metadata: { title: 'Imported', tags: ['x'] },
    cells: [
      { id: 'a', type: 'code', content: '2 + 3' },
      { id: 'b', type: 'test', content: 'a == 5', dependsOn: ['a'] },
    ],
  });

  it('builds a validated .mtsw from a JSON doc (round-trips + runs)', async () => {
    const out = join(dir, 'imported.mtsw');
    const r = await dispatch(['import', file('in.json', DOC), '-o', out]);
    expect(r.exitCode).toBe(0);
    const c = readFileSync(out, 'utf-8');
    expect(c).toContain('title: Imported');
    expect(c).toContain('depends_on');
    expect((await dispatch(['run', out])).exitCode).toBe(0); // the test cell passes
  });

  it('prints the .mtsw to stdout when no -o', async () => {
    const r = await dispatch(['import', file('in2.json', DOC)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('cells:');
  });

  it('--json reports ok + cell count', async () => {
    const env = JSON.parse((await dispatch(['import', file('in3.json', DOC), '--json'])).stdout);
    expect(env.command).toBe('import');
    expect(env.ok).toBe(true);
    expect(env.data.cells).toBe(2);
  });

  it('rejects invalid input (cycle, bad type, no cells array)', async () => {
    const cyc = file('cyc.json', JSON.stringify({ cells: [
      { id: 'a', type: 'code', content: 'b', dependsOn: ['b'] },
      { id: 'b', type: 'code', content: 'a', dependsOn: ['a'] },
    ] }));
    expect((await dispatch(['import', cyc])).exitCode).toBe(1);
    const bad = file('bad.json', JSON.stringify({ cells: [{ id: 'x', type: 'frobnicate', content: '1' }] }));
    expect((await dispatch(['import', bad])).exitCode).toBe(1);
    const noCells = file('nc.json', JSON.stringify({ foo: 1 }));
    expect((await dispatch(['import', noCells])).exitCode).toBe(1);
  });
});

describe('chart validation + capabilities discoverability', () => {
  it('validate flags a chart spec referencing unknown cells', async () => {
    const p = fixture('cells:\n  - visualization: |\n      type: line\n      x: { data: nope }\n      y: { data: alsoNope }\n    id: ch');
    const env = JSON.parse((await dispatch(['validate', p, '--json'])).stdout);
    expect(env.ok).toBe(false);
    expect(env.problems.join(' ')).toMatch(/unknown cell/i);
  });

  it('validate flags a malformed chart spec', async () => {
    const p = fixture('cells:\n  - visualization: "just a string, not a mapping"\n    id: ch');
    const env = JSON.parse((await dispatch(['validate', p, '--json'])).stdout);
    expect(env.ok).toBe(false);
  });

  it('capabilities exposes per-cell-type schemas incl. the chart spec', async () => {
    const env = JSON.parse((await dispatch(['capabilities', '--json'])).stdout);
    expect(env.data.cellSchemas.visualization).toMatch(/line\|scatter\|bar/);
    expect(env.data.cellSchemas.code).toBeDefined();
    expect(env.data.cellTypes.supported).toContain('visualization');
  });

  it('export adds a visible note when a chart data cell errored', async () => {
    const p = fixture(
      'cells:\n  - data: "[1, 2]"\n    id: xs\n  - code: "undefinedVar + 1"\n    id: ys\n  - visualization: |\n      type: line\n      x: { data: xs }\n      y: { data: ys }\n    id: ch\n    depends_on: [xs, ys]'
    );
    const r = await dispatch(['export', p]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('chart data did not resolve');
  });
});
