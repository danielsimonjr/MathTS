import { describe, it, expect } from 'vitest';
import { exportCommand } from '../src/cli.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MTSW = `metadata:
  title: T
cells:
  - equation: "sin(x)^2"
    id: eq
  - markdown: "cost is 50%"
    id: note
`;

function writeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mtsw-tex-'));
  const f = join(dir, 'wb.mtsw');
  writeFileSync(f, MTSW, 'utf-8');
  return f;
}

describe('mtsw export --format tex', () => {
  it('emits a standalone LaTeX document to stdout', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'tex', '--no-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('\\documentclass{article}');
    expect(r.stdout).toContain('\\[');
    expect(r.stdout).toContain('50\\%');
    expect(r.stdout).toContain('\\end{document}');
  });
  it('--fragment omits the preamble', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'tex', '--fragment', '--no-run']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain('\\documentclass');
  });
  it('rejects an unknown format', async () => {
    const r = await exportCommand([writeTmp(), '--format', 'pdf', '--no-run']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/format/i);
  });
});
