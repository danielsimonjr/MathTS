import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `bun test` reads `__snapshots__/golden-svg.test.ts.snap` (Bun format). The vitest run on
 * Node reads `__snapshots__/vitest/golden-svg.test.ts.snap` (Vitest format), because vitest
 * cannot parse the Bun header. Both files must lock the SAME golden SVG output, so this test
 * fails when one copy changes and the other does not.
 */
function loadSnapshots(relPath: string, separator: string): Record<string, string> {
  const source = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8');
  const exportsObj: Record<string, string> = {};
  // Both formats are plain `exports[\`key\`] = \`value\`;` assignments.
  new Function('exports', source)(exportsObj);
  // Bun joins the describe and test names with ' '; Vitest joins them with ' > '.
  return Object.fromEntries(
    Object.entries(exportsObj).map(([key, value]) => [key.split(separator).join(' '), value])
  );
}

describe('golden SVG snapshot parity (bun test vs vitest)', () => {
  it('both snapshot files hold identical keys and values', () => {
    const bunSnap = loadSnapshots('./__snapshots__/golden-svg.test.ts.snap', ' ');
    const vitestSnap = loadSnapshots('./__snapshots__/vitest/golden-svg.test.ts.snap', ' > ');
    expect(Object.keys(bunSnap).length).toBeGreaterThan(0);
    expect(vitestSnap).toEqual(bunSnap);
  });
});
