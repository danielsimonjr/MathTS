// Fixed-size kernels against their allocating twins (issue 375).
// Run after the functions build: node tools/benchmark/functions/fixed-kernels.bench.mjs
// Each row first checks that the kernel and the twin give the same bits (exit 1 if not), then
// times them in ABBA order over REPS warm repetitions and prints the median ops/s and the ratio.
// The control row times the kernel against itself and must read about 1.00.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const F = await import(pathToFileURL(join(ROOT, 'functions/dist/index.js')).href);

const REPS = Number(process.env.REPS ?? 7);
const CALLS = Number(process.env.CALLS ?? 200_000);

const q = Float64Array.of(0.9, 0.1, 0.2, 0.3);
const p = Float64Array.of(0.8, -0.2, 0.4, 0.1);
const v = Float64Array.of(0.3, -0.7, 1.1);
const w = Float64Array.of(-0.4, 0.2, 0.9);
const out4 = new Float64Array(4);
const out3 = new Float64Array(3);
const qa = Array.from(q);
const pa = Array.from(p);
const va = Array.from(v);
const wa = Array.from(w);

const rows = [
  {
    name: 'quatMultiply',
    kernel: () => F.quatMultiply(out4, q, p),
    twin: () => F.quaternionMultiply(qa, pa),
    same: () => Array.from(F.quatMultiply(out4, q, p)),
    twinValue: () => F.quaternionMultiply(qa, pa),
  },
  {
    name: 'quatRotate',
    kernel: () => F.quatRotate(out3, q, v),
    twin: () => F.quaternionRotate(qa, va),
    same: () => Array.from(F.quatRotate(out3, q, v)),
    twinValue: () => F.quaternionRotate(qa, va),
  },
  {
    name: 'quatNormalize',
    kernel: () => F.quatNormalize(out4, q),
    twin: () => F.quaternionNormalize(qa),
    same: () => Array.from(F.quatNormalize(out4, q)),
    twinValue: () => F.quaternionNormalize(qa),
  },
  {
    name: 'vec3Cross',
    kernel: () => F.vec3Cross(out3, v, w),
    twin: () => F.cross(va, wa),
    same: () => Array.from(F.vec3Cross(out3, v, w)),
    twinValue: () => F.cross(va, wa),
  },
];

function sameBits(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++)
    if (!Object.is(a[i], b[i]) && !(a[i] === 0 && b[i] === 0)) return false;
  return true;
}

function opsPerSecond(fn) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < CALLS; i++) fn();
  const ns = Number(process.hrtime.bigint() - t0);
  return (CALLS * 1e9) / ns;
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function measure(a, b) {
  for (let k = 0; k < 3; k++) {
    opsPerSecond(a);
    opsPerSecond(b);
  }
  const ra = [];
  const rb = [];
  for (let k = 0; k < REPS; k++) {
    // ABBA: alternate the order so drift and warm-up do not favour one side.
    if (k % 2 === 0) {
      ra.push(opsPerSecond(a));
      rb.push(opsPerSecond(b));
    } else {
      rb.push(opsPerSecond(b));
      ra.push(opsPerSecond(a));
    }
  }
  return { a: median(ra), b: median(rb) };
}

let failed = false;
console.log(`fixed-size kernels vs twins: ${REPS} reps x ${CALLS} calls, median ops/s`);
for (const row of rows) {
  if (!sameBits(row.same(), row.twinValue())) {
    console.error(`${row.name}: kernel and twin give different bits`);
    failed = true;
    continue;
  }
  const { a, b } = measure(row.kernel, row.twin);
  console.log(
    `${row.name.padEnd(14)} kernel ${a.toExponential(3)}  twin ${b.toExponential(3)}  ratio ${(a / b).toFixed(2)}`
  );
}
const control = measure(rows[0].kernel, rows[0].kernel);
console.log(
  `${'control'.padEnd(14)} kernel vs kernel ratio ${(control.a / control.b).toFixed(2)} (expect about 1.00)`
);
if (failed) process.exit(1);
