import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'type-consumer-g17');
const require = createRequire(import.meta.url);
const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

/** Issue repro fixtures; keep in sync with dogfood G17 plan. */
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

  it('issue repro fixtures typecheck with skipLibCheck false (NodeNext and Node16)', () => {
    for (const config of ['tsconfig.json', 'tsconfig.node16.json']) {
      const out = execFileSync(
        process.execPath,
        [tsc, '-p', join(FIXTURE_DIR, config), '--pretty', 'false'],
        {
          encoding: 'utf8',
        }
      );
      expect(out).toBe('');
    }
  });
});
