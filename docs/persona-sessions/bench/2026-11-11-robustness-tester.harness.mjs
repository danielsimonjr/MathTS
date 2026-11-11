/**
 * Re-runnable robustness / fast-check harness for MathTS published packages.
 *
 * Usage (outside this repo, Node 22+):
 *   mkdir /tmp/mathts-robust && cd /tmp/mathts-robust
 *   npm init -y
 *   npm i fast-check @danielsimonjr/mathts-functions @danielsimonjr/mathts-core \
 *     @danielsimonjr/mathts-matrix @danielsimonjr/mathts-units \
 *     @danielsimonjr/mathts-parallel @danielsimonjr/mathts-workbook \
 *     @danielsimonjr/mathts-workerpool
 *   node /path/to/2026-11-11-robustness-tester.harness.mjs
 *
 * Fixed seed so failures shrink to a stable counterexample.
 */
import fc from 'fast-check';
import { evaluate, parse, add, multiply } from '@danielsimonjr/mathts-functions';
import {
  addScalar,
  number as toNumber,
  divideScalar,
  multiplyScalar,
} from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { Unit } from '@danielsimonjr/mathts-units';
import { WorkerPool } from '@danielsimonjr/mathts-parallel';
import { parseWorkbook, createExecutor } from '@danielsimonjr/mathts-workbook';

export const SEED = 20261111;
const findings = [];

function record(id, ok, detail) {
  findings.push({ id, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', id, detail ?? '');
}

function caught(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// --- 1. WorkerPool missing script: unhandled rejection, not a sync TypeError
{
  let unhandled = null;
  const onUnhandled = (e) => {
    unhandled = e;
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    new WorkerPool();
  } catch (e) {
    unhandled = e;
  }
  await new Promise((r) => setTimeout(r, 150));
  process.off('unhandledRejection', onUnhandled);
  const msg = String(unhandled?.message ?? unhandled ?? '');
  record('workerpool-missing-script', msg.includes('startsWith'), msg.slice(0, 180));
}

// --- 2. core scalar null crashes
{
  const r = caught(() => addScalar(null, 1));
  record(
    'addScalar-null',
    !r.ok && String(r.error?.message).includes("reading 'im'"),
    r.ok ? r.value : `${r.error?.constructor?.name}: ${r.error?.message}`
  );
  const r2 = caught(() => toNumber(null));
  record(
    'number-null',
    !r2.ok && String(r2.error?.message).includes("reading 'im'"),
    r2.ok ? r2.value : `${r2.error?.constructor?.name}: ${r2.error?.message}`
  );
  const r3 = caught(() => divideScalar(undefined, 1));
  record(
    'divideScalar-undefined',
    !r3.ok && String(r3.error?.message).includes("reading 'im'"),
    r3.ok ? r3.value : `${r3.error?.constructor?.name}: ${r3.error?.message}`
  );
  const r4 = caught(() => multiplyScalar(null, 2));
  record(
    'multiplyScalar-null',
    !r4.ok && String(r4.error?.message).includes("reading 'im'"),
    r4.ok ? r4.value : `${r4.error?.constructor?.name}: ${r4.error?.message}`
  );
}

// --- 3. evaluate leaks parse / typed
{
  const p = evaluate('parse');
  const t = evaluate('typed');
  record('evaluate-leaks-parse', typeof p === 'function', typeof p);
  record('evaluate-leaks-typed', typeof t === 'function', typeof t);
  const made = caught(() => evaluate('typed({"number": sin})'));
  record(
    'evaluate-typed-callable',
    made.ok && typeof made.value === 'function',
    made.ok ? 'function' : made.error?.message
  );
}

// --- 4. huge integer literal → Infinity
{
  const v = evaluate('9'.repeat(400));
  record('huge-int-infinity', v === Infinity, v);
  const n = parse('1e309');
  record('parse-1e309-infinity', n.value === Infinity, n?.value ?? n);
}

// --- 5. DenseMatrix.zeros unbounded allocation
{
  const r = caught(() => DenseMatrix.zeros(1e8, 1e8));
  record(
    'zeros-1e8',
    !r.ok && r.error instanceof RangeError,
    r.ok ? 'allocated' : `${r.error?.constructor?.name}: ${String(r.error?.message).slice(0, 120)}`
  );
}

// --- 6. Unit parser timing (quadratic-ish invalid identifier)
{
  const times = [];
  for (const n of [2000, 4000, 8000]) {
    const s = 'm'.repeat(n);
    const t0 = performance.now();
    caught(() => new Unit(1, s));
    times.push({ n, ms: performance.now() - t0 });
  }
  const ratio = times[2].ms / times[0].ms;
  record('unit-parse-scaling', ratio > 3, { times, ratio: Number(ratio.toFixed(2)) });
}

// --- 7. angle .value stays radians
{
  const u = new Unit(180, 'deg');
  const back = u.to('rad').to('deg');
  record(
    'deg-value-not-180',
    u.value === Math.PI && back.value === Math.PI && String(back).includes('180'),
    { value: u.value, toString: String(u), roundTripValue: back.value, roundTripStr: String(back) }
  );
}

// --- 8. add() type errors vs coercion
{
  const nullErr = caught(() => add(null, 1));
  record(
    'add-null-too-few',
    !nullErr.ok && String(nullErr.error?.message).includes('Too few arguments'),
    nullErr.error?.message
  );
  record('add-true-coerces', add(true, 1) === 2, add(true, 1));
  const addStr = add('2', 1);
  record(
    'add-string-returns-complex',
    addStr?.type === 'Complex' && addStr.re === 3 && addStr.im === 0,
    addStr
  );
  const addBig = add(1n, 1);
  record(
    'add-bigint-returns-fraction',
    addBig?.type === 'Fraction' && String(addBig) === '2',
    addBig
  );
}

// --- 9. DenseMatrix constructor vs fromArray
{
  const ctor = caught(
    () =>
      new DenseMatrix([
        [1, 2],
        [3, 4],
      ])
  );
  record(
    'dense-ctor-2d',
    !ctor.ok && String(ctor.error?.message).includes('1,2,3,4'),
    ctor.error?.message
  );
  const ok = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
  ]).toArray();
  record(
    'dense-fromArray',
    JSON.stringify(ok) ===
      JSON.stringify([
        [1, 2],
        [3, 4],
      ]),
    ok
  );
}

// --- 10. multiply scalar
{
  const m = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
  ]);
  const r = caught(() => m.multiply(2));
  record(
    'multiply-scalar',
    !r.ok && String(r.error?.message).includes('undefined'),
    r.ok ? r.value : r.error?.message
  );
}

// --- 11. process identity via scope
{
  const r = evaluate('process', { process });
  record('scope-returns-process', r === process, Object.prototype.toString.call(r));
}

// --- 12. comments
{
  const r = caught(() => parse('/* c */ 1'));
  record('block-comment', !r.ok, r.ok ? r.value : r.error?.message);
}

// --- 13. workbook constructor key
{
  const src = `
version: "1.0"
metadata: { title: t }
cells:
  - code: "{ secret: 42, constructor: 1 }"
    id: user
`;
  const parsed = parseWorkbook(src);
  let status = 'unrun';
  if (parsed.success) {
    const report = await createExecutor(parsed.workbook).runReport();
    status = report.cells[0]?.status + ' ' + (report.cells[0]?.error ?? '');
  }
  record('workbook-constructor-key', String(status).includes('constructor'), status);
}

// --- 14. NaN unit
{
  const u = new Unit(NaN, 'm');
  record('unit-nan-value', Number.isNaN(u.value), String(u));
}

// --- property: add commute
{
  let fail = null;
  try {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        (a, b) => add(a, b) === add(b, a) || Object.is(add(a, b), add(b, a))
      ),
      { seed: SEED, numRuns: 200 }
    );
  } catch (e) {
    fail = e.message;
  }
  record('prop-add-commute', !fail, fail);
}

// --- property: multiply commute
{
  let fail = null;
  try {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e3, max: 1e3 }),
        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e3, max: 1e3 }),
        (a, b) => {
          const x = multiply(a, b);
          const y = multiply(b, a);
          return x === y || Object.is(x, y);
        }
      ),
      { seed: SEED, numRuns: 200 }
    );
  } catch (e) {
    fail = e.message;
  }
  record('prop-mul-commute', !fail, fail);
}

// --- property: random strings never throw non-Error / never stack overflow
{
  let fail = null;
  try {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (s) => {
        try {
          evaluate(s);
        } catch (e) {
          if (!(e instanceof Error)) return false;
          if (e instanceof RangeError && /stack/i.test(e.message)) return false;
        }
        return true;
      }),
      { seed: SEED, numRuns: 400 }
    );
  } catch (e) {
    fail = e.message;
  }
  record('prop-eval-no-crash', !fail, fail);
}

console.log(JSON.stringify({ seed: SEED, findings }, null, 2));
