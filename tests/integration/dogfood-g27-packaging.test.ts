import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

const require = createRequire(import.meta.url);
const { ciStepProblem } = require(join(REPO, 'tools/test/ci-step.mjs')) as {
  ciStepProblem: (command: string) => string | null;
};

describe('G27 packaging (#707 #708 #736 #791 #792)', () => {
  // The bundles (esbuild runs of the package graphs) and the README stats check do not run in this
  // pool, where a wall-clock limit would measure the load of the other processes (#1185). The
  // Compile & Lint job runs them as their own steps; these tests pin those steps.
  it('#708 the Compile & Lint job bundles matrix and functions evaluate for the browser', () => {
    expect(ciStepProblem('node tools/test/browser-bundle-neutral.mjs')).toBeNull();
  });

  it('#930 #792 the Compile & Lint job checks the evaluate bundle sizes and the README stats', () => {
    // tools/test/packaging-gates.test.mjs holds both checks.
    expect(ciStepProblem('node --test tools/test/packaging-gates.test.mjs')).toBeNull();
  });

  it('#736 documents ESM-only consumption', () => {
    const readme = readFileSync(join(REPO, 'compat/README.md'), 'utf8');
    expect(readme).toMatch(/ESM only/i);
    expect(readme).toMatch(/import\(/);
  });

  it('#791 package READMEs use GitHub blob links for API docs', () => {
    for (const pkg of ['autograd', 'compat', 'expression', 'plot'] as const) {
      const readme = readFileSync(join(REPO, pkg, 'README.md'), 'utf8');
      expect(readme).toMatch(
        /https:\/\/github\.com\/danielsimonjr\/MathTS\/blob\/main\/docs\/api\//
      );
      expect(readme).not.toMatch(/`docs\/api\/[^`]+\.md`/);
    }
  });
});
