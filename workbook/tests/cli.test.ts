import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let counter = 0;

function fixture(content: string): string {
  const path = join(dir, `wb-${counter++}.mtsw`);
  writeFileSync(path, content, 'utf-8');
  return path;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-cli-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PASSING = `
cells:
  - markdown: "# Demo"
    id: intro
  - code: "2 + 3"
    id: a
  - data: |
      pi: 3.14
    id: consts
  - test: "a == 5"
    id: checkA
    depends_on: [a]
`;

describe('cli dispatch', () => {
  it('should show help with no args', async () => {
    const r = await dispatch([]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('mtsw');
  });

  it('should error on an unknown command', async () => {
    const r = await dispatch(['frobnicate']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Unknown command');
  });
});

describe('cli run', () => {
  it('should run a passing workbook (markdown + code + data + test) with exit 0', async () => {
    const r = await dispatch(['run', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('a (code): 5');
    expect(r.stdout).toContain('checkA (test)');
    expect(r.stdout).toContain('intro (markdown)');
    expect(r.stdout).toContain('consts (data)');
  });

  it('should exit non-zero with parse errors on stderr', async () => {
    const r = await dispatch(['run', fixture('cells:\n  - code: "1"\n    id: bad-id')]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('valid identifier');
    expect(r.stdout).toBe('');
  });

  it('should report a failing test on stderr and still list cells on stdout', async () => {
    const wb = 'cells:\n  - code: "5"\n    id: a\n  - test: "a == 9"\n    id: checkA\n    depends_on: [a]';
    const r = await dispatch(['run', fixture(wb)]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('checkA');
    expect(r.stdout).toContain('a (code): 5');
  });

  it('should emit valid JSON and still exit non-zero with --json on failure', async () => {
    const wb = 'cells:\n  - code: "5"\n    id: a\n  - test: "a == 9"\n    id: checkA\n    depends_on: [a]';
    const r = await dispatch(['run', fixture(wb), '--json']);
    expect(r.exitCode).toBe(1);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.cells.find((c: { id: string }) => c.id === 'checkA').status).toBe('fail');
  });
});

describe('cli validate', () => {
  it('should report OK for a valid workbook', async () => {
    const r = await dispatch(['validate', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('should flag a missing id', async () => {
    const r = await dispatch(['validate', fixture('cells:\n  - code: "1"')]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('missing "id"');
  });

  it('should flag a dependency cycle', async () => {
    const wb =
      'cells:\n  - code: "b"\n    id: a\n    depends_on: [b]\n  - code: "a"\n    id: b\n    depends_on: [a]';
    const r = await dispatch(['validate', fixture(wb)]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toLowerCase()).toContain('cycle');
  });
});

describe('cli graph', () => {
  it('should emit a mermaid diagram with -f mermaid', async () => {
    const r = await dispatch(['graph', fixture(PASSING), '-f', 'mermaid']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^graph TD/);
    expect(r.stdout).toContain('a --> checkA');
  });

  it('should emit a text adjacency by default', async () => {
    const r = await dispatch(['graph', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('checkA: [a]');
  });

  it('should accept the -f flag before the filename', async () => {
    const r = await dispatch(['graph', '-f', 'mermaid', fixture(PASSING)]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^graph TD/);
  });
});
