import { describe, it, expect } from 'vitest';
import { parseWorkbook, createExecutor } from '../src/index.js';

describe('dogfood #818 workbook object literal forbidden keys', () => {
  it('skips constructor and dependent reads secret', async () => {
    const src = `
version: "1.0"
metadata: { title: t }
cells:
  - code: "{ secret: 42, constructor: 1 }"
    id: user
  - code: "user.secret"
    id: steal
    depends_on: [user]
`;
    const p = parseWorkbook(src);
    if (!p.workbook) throw new Error('parse failed');
    const report = await createExecutor(p.workbook).runReport();
    const byId = Object.fromEntries(report.cells.map((c) => [c.id, c]));
    expect(byId.user.status).toBe('success');
    expect((byId.user.output as { secret: number }).secret).toBe(42);
    expect(byId.steal.status).toBe('success');
    expect(byId.steal.output).toBe(42);
  });
});
