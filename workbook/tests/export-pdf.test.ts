import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let n = 0;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wb-pdf-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
function fixture(content: string): string {
  const p = join(dir, `wb-${n++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('mtsw export --format pdf', () => {
  it('errors clearly when -o is missing (PDF is binary)', async () => {
    const file = fixture(`cells:\n  - markdown: "# Hi"\n    id: t\n`);
    const res = await dispatch(['export', file, '--format', 'pdf']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/-o|output/i);
  });
  it('surfaces a clear error when no LaTeX engine is available', async () => {
    // If a LaTeX engine IS installed this test is skipped; otherwise assert the message.
    const { latexToPdf } = await import('@danielsimonjr/mathts-plot/render');
    let hasLatex = true;
    try {
      await latexToPdf(
        '\\documentclass{article}\\begin{document}x\\end{document}',
        join(dir, 'probe.pdf')
      );
    } catch {
      hasLatex = false;
    }
    if (hasLatex) return; // real engine present — nothing to assert here
    const file = fixture(`cells:\n  - markdown: "# Hi"\n    id: t\n`);
    const res = await dispatch(['export', file, '--format', 'pdf', '-o', join(dir, 'out.pdf')]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/LaTeX|pdflatex|tectonic/i);
  });
});
