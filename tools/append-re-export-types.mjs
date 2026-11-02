// Post-build step of the ast and parser packages, run from the package folder.
// Copies src/re-export-types.d.ts into dist/ and appends a type-only re-export of it
// to dist/index.d.ts. Plain Node, so the build runs on every shell (the Bun shell has
// no printf on Windows). A second run adds nothing, so dev watch reruns are safe.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RE_EXPORT_LINE = 'export type * from "./re-export-types.js";';

export function appendReExportTypes(pkgDir = process.cwd()) {
  fs.copyFileSync(
    path.join(pkgDir, 'src', 're-export-types.d.ts'),
    path.join(pkgDir, 'dist', 're-export-types.d.ts')
  );

  const indexPath = path.join(pkgDir, 'dist', 'index.d.ts');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`append-re-export-types: ${indexPath} is missing`);
  }

  let text = fs.readFileSync(indexPath, 'utf8');
  if (!text.includes(RE_EXPORT_LINE)) {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
    text += `${RE_EXPORT_LINE}\n`;
    fs.writeFileSync(indexPath, text);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  appendReExportTypes(process.cwd());
}
