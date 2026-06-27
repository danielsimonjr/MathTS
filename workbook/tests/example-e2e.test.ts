import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseWorkbook, createExecutor } from '../src/index.js';

// tests/ -> workbook/ -> repo root -> examples/
const here = fileURLToPath(new URL('.', import.meta.url));
const examplePath = join(here, '..', '..', 'examples', 'basic-workbook.mtsw');

describe('examples/basic-workbook.mtsw end-to-end', () => {
  it('parses, executes in dependency order, and all test cells pass', async () => {
    const content = readFileSync(examplePath, 'utf-8');

    const parsed = parseWorkbook(content);
    expect(parsed.success).toBe(true);

    const report = await createExecutor(parsed.workbook!).runReport();
    expect(report.ok).toBe(true);

    const tests = report.cells.filter((c) => c.type === 'test');
    expect(tests.length).toBeGreaterThan(0);
    expect(tests.every((t) => t.status === 'pass')).toBe(true);
  });
});
