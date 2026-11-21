/**
 * Drift guard of the `OUTPUT_PARAMS` table of `scripts/patch-glue.mjs` (#1026).
 *
 * The build checks that the table names every lowered parameter of the glue. It cannot see a
 * kernel that writes a parameter that the table calls `in`: the caller would lose that write
 * again, which is the symptom of #1026. The debug glue catches it at run time: it throws
 * `mathts glue: <export> wrote its input parameter <param>`.
 *
 * This test calls EVERY export of the table once through `build/mathts-debug.js` with generic
 * arguments, and fails when any call throws that error. An export that the generic call does
 * not exercise (the kernel asserts, or the sizes do not fit) needs a hand-written valid call in
 * `HAND`. The test fails when an export is exercised by neither.
 *
 * Plain asserts, no framework: the test runs with `node` and with `bun`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as glue from '../build/mathts-debug.js';
import { OUTPUT_PARAMS } from '../scripts/patch-glue.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dts = readFileSync(join(here, '../build/mathts-debug.d.ts'), 'utf8');

/** Declared parameter types of every function export, from the generated declaration file. */
const SIGNATURES = new Map();
for (const match of dts.matchAll(/export declare function (\w+)\(([^)]*)\): [^;]+;/g)) {
  const params = match[2]
    .split(/,\s*/)
    .filter(Boolean)
    .map((part) => {
      const [name, type] = part.split(/:\s*/);
      return { name, type };
    });
  SIGNATURES.set(match[1], params);
}

// Two generic argument sets: a ramp with small integers, and a bounded pseudo-random fill.
let seed = 12345;
const random = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return 0.5 + seed / 0x7fffffff;
};
const ARGUMENT_SETS = [
  { size: 64, number: 2, fill: (i) => i + 1 },
  { size: 64, number: 3, fill: () => random() },
];

function genericArguments(params, set) {
  return params.map(({ type }) => {
    if (type.startsWith('Float64Array'))
      return Float64Array.from({ length: set.size }, (_, i) => set.fill(i));
    if (type === 'Int32Array') return Int32Array.from({ length: set.size }, (_, i) => i + 1);
    if (type === 'number') return set.number;
    if (type === 'boolean') return true;
    if (type.startsWith('__Internref')) return glue.complex(1.5, -0.5);
    throw new Error(`sweep: no generic argument for the type ${type}`);
  });
}

/** Hand-written valid calls, by export. Each must return normally (and so pass the check). */
const f64 = (...values) => Float64Array.from(values);
const HAND = {
  // The result holds x.length * y.length values; the generic arrays of 64 would run out of it.
  matrix_outer: () => glue.matrix_outer(f64(1, 2, 3), f64(4, 5, 6, 7), new Float64Array(12)),
};

const wroteInput = (error) => /wrote its input parameter/.test(String(error?.message));

const violations = [];
const unexercised = [];
let exercised = 0;
for (const name of Object.keys(OUTPUT_PARAMS)) {
  assert.equal(typeof glue[name], 'function', `${name} is not an export of the debug glue`);
  const params = SIGNATURES.get(name);
  assert.ok(params, `${name} is not declared in mathts-debug.d.ts`);
  const attempts = [
    ...ARGUMENT_SETS.map((set) => () => glue[name](...genericArguments(params, set))),
    ...(HAND[name] ? [HAND[name]] : []),
  ];
  let ok = false;
  for (const attempt of attempts) {
    try {
      attempt();
      ok = true;
    } catch (error) {
      if (wroteInput(error)) {
        violations.push(`${name}: ${error.message}`);
        ok = true;
        break;
      }
    }
  }
  if (ok) exercised++;
  else unexercised.push(name);
}

const total = Object.keys(OUTPUT_PARAMS).length;
console.log(`glue-table-sweep: exercised ${exercised} of ${total}`);
if (unexercised.length > 0) {
  console.log(`  not exercised (add a call to HAND): ${unexercised.join(', ')}`);
}
if (violations.length > 0) {
  console.log(
    `  a kernel writes a parameter that the table calls 'in':\n    ${violations.join('\n    ')}`
  );
}
assert.equal(violations.length, 0, 'a kernel writes an input parameter');
assert.equal(unexercised.length, 0, 'an export of the table is not exercised');
console.log('glue-table-sweep: ok');
