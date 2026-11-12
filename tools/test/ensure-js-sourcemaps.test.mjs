import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../ensure-js-sourcemaps.mjs', import.meta.url));

test('a rebuilt .js whose old .map is still present gets its sourceMappingURL back', () => {
  const pkg = mkdtempSync(join(tmpdir(), 'mathts-maps-'));
  try {
    mkdirSync(join(pkg, 'build'));
    // A rebuild rewrote the .js and left the .map of the earlier build.
    writeFileSync(join(pkg, 'build', 'mod.js'), 'export const a = 1;\n');
    writeFileSync(join(pkg, 'build', 'mod.js.map'), '{"version":3,"sources":["./mod.js"],"mappings":""}');
    execFileSync(process.execPath, [TOOL], { cwd: pkg, stdio: 'pipe' });
    const js = readFileSync(join(pkg, 'build', 'mod.js'), 'utf8');
    assert.match(js, /\/\/# sourceMappingURL=mod\.js\.map\n$/);
  } finally {
    rmSync(pkg, { recursive: true, force: true });
  }
});
