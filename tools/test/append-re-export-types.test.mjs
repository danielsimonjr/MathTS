// node --test tools/test/append-re-export-types.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendReExportTypes, RE_EXPORT_LINE } from '../append-re-export-types.mjs';

function pkg() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mathts-reexport-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'src', 're-export-types.d.ts'), 'export type { A } from "x";\n');
  fs.writeFileSync(path.join(root, 'dist', 'index.d.ts'), 'export * from "./index.js";');
  return root;
}

test('copies the types file and appends the re-export line', () => {
  const root = pkg();
  appendReExportTypes(root);
  assert.equal(
    fs.readFileSync(path.join(root, 'dist', 're-export-types.d.ts'), 'utf8'),
    'export type { A } from "x";\n'
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'dist', 'index.d.ts'), 'utf8'),
    `export * from "./index.js";\n${RE_EXPORT_LINE}\n`
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('a second run does not add the line twice (dev watch)', () => {
  const root = pkg();
  appendReExportTypes(root);
  appendReExportTypes(root);
  const text = fs.readFileSync(path.join(root, 'dist', 'index.d.ts'), 'utf8');
  assert.equal(text.split(RE_EXPORT_LINE).length - 1, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a missing dist/index.d.ts fails loudly', () => {
  const root = pkg();
  fs.rmSync(path.join(root, 'dist', 'index.d.ts'));
  assert.throws(() => appendReExportTypes(root), /index\.d\.ts/);
  fs.rmSync(root, { recursive: true, force: true });
});
