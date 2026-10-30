import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseExportNames } from './check-export-lock.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const checker = join(repoRoot, 'tools/test/check-export-lock.mjs');

test('parseExportNames collects value and type exports', () => {
  const text = `
export type { Foo };
export { bar, type Baz };
export function fn() {}
export declare const VERSION: string;
`;
  const names = parseExportNames(text);
  assert.equal(names.get('Foo'), 'type');
  assert.equal(names.get('Baz'), 'type');
  assert.equal(names.get('bar'), 'value');
  assert.equal(names.get('fn'), 'value');
  assert.equal(names.get('VERSION'), 'value');
});

test('added export name fails lock until --write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'export-lock-'));
  const lockPath = join(dir, 'export-lock.json');
  writeFileSync(
    lockPath,
    JSON.stringify({
      '@fixture/pkg': { '.': { only: { kind: 'number' } } },
    })
  );
  const dts = 'export declare const only: number;\nexport declare const extra: number;\n';
  const live = parseExportNames(dts);
  assert.ok(live.has('extra'));
  assert.notEqual(
    JSON.stringify({ only: { kind: 'number' } }),
    JSON.stringify(
      Object.fromEntries(
        [...live.entries()].map(([name, kind]) => [
          name,
          { kind: kind === 'type' ? 'type' : 'number' },
        ])
      )
    )
  );
  const child = spawnSync(process.execPath, [checker], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(child.status, 0, 'repo lock should match current build');
});
