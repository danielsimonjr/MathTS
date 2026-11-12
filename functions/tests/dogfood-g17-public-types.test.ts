import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'type-consumer-g17');

describe('dogfood G17 public TypeScript types', () => {
  it('gen-public-overloads matches committed generated declarations', () => {
    const out = execFileSync('node', ['scripts/gen-public-overloads.mjs', '--check'], {
      cwd: join(FIXTURE_DIR, '../..'),
      encoding: 'utf8',
    });
    expect(out).toContain('up to date');
  });

  it('issue repro fixtures typecheck with skipLibCheck false (no DOM lib)', () => {
    const tsc = execFileSync(
      'npx',
      ['tsc', '-p', join(FIXTURE_DIR, 'tsconfig.json'), '--pretty', 'false'],
      { encoding: 'utf8' }
    );
    expect(tsc).toBe('');
  });
});
