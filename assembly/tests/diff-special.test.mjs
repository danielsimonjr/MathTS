/**
 * Differential test: the 18 hand-rolled special functions vs mpmath goldens.
 *
 * Tests the RELEASE binding (build/mathts.js -> build/mathts.wasm), i.e. the
 * artifact that actually ships as `main`, not the debug wasm the legacy tests
 * use. Goldens are produced by golden/generate_goldens.py (mpmath, 30 digits).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as wasm from '../build/mathts.js';
import { createReport } from './_diff-harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(path.join(here, 'golden', 'special.golden.json'), 'utf-8')
);

// Marshal a single case per its declared kind; return the scalar wasm output.
function callOne(fn, kind, c) {
  switch (kind) {
    case 'vec1':     return wasm[fn](new Float64Array([c[0]]))[0];
    case 'int_vec1': return wasm[fn](c[0], new Float64Array([c[1]]))[0];
    case 'vec2':     return wasm[fn](new Float64Array([c[0]]), new Float64Array([c[1]]))[0];
    case 'vec3':     return wasm[fn](new Float64Array([c[0]]), new Float64Array([c[1]]),
                                     new Float64Array([c[2]]))[0];
    case 'vec4':     return wasm[fn](new Float64Array([c[0]]), new Float64Array([c[1]]),
                                     new Float64Array([c[2]]), new Float64Array([c[3]]))[0];
    default: throw new Error(`unknown kind ${kind}`);
  }
}

const report = createReport(
  'mathts-wasm special functions vs mpmath (RELEASE binary)',
  golden.target_rel,
  golden.hard_fail_rel
);

for (const [fn, spec] of Object.entries(golden.functions)) {
  if (typeof wasm[fn] !== 'function') {
    report.addScore(`${fn} [MISSING EXPORT]`, Infinity);
    continue;
  }
  for (const c of spec.cases) {
    const expected = c[c.length - 1];
    const args = c.slice(0, -1);
    const actual = callOne(fn, spec.kind, c);
    report.add(`${fn}(${args.join(',')})`, actual, expected);
  }
}

process.exit(report.finish() ? 0 : 1);
