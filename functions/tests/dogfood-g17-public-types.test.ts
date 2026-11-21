import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'type-consumer-g17');

/**
 * Issue repro fixtures; keep in sync with dogfood G17 plan. The tsc run on the fixture folder
 * (skipLibCheck false, NodeNext and Node16) is `node tools/test/check-g17-types.mjs`, a step of
 * the Compile & Lint job; it does not run in this pool (#1185).
 */
describe('dogfood G17 public TypeScript types', () => {
  it('gen-public-overloads matches committed generated declarations', () => {
    const out = execFileSync('node', ['scripts/gen-public-overloads.mjs', '--check'], {
      cwd: join(FIXTURE_DIR, '../..'),
      encoding: 'utf8',
    });
    expect(out).toContain('up to date');
  });

  it('shipped gpu and matrix declarations do not reference @webgpu/types', () => {
    for (const dir of [
      join(FIXTURE_DIR, '../../../gpu/dist'),
      join(FIXTURE_DIR, '../../../matrix/dist'),
      join(FIXTURE_DIR, '../../dist'),
    ]) {
      const files = readdirSync(dir, { recursive: true }) as string[];
      for (const file of files) {
        if (!file.endsWith('.d.ts')) continue;
        const text = readFileSync(join(dir, file), 'utf8');
        expect(text, join(dir, file)).not.toContain('@webgpu/types');
      }
    }
  });
});
