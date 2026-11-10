// Worker for tests/nonfinite-inputs.test.ts.
// It loads a bundle of functions/src and runs each job in order.
// Before each call it posts the job, so the parent can name a call that does not return.
import { parentPort, workerData } from 'node:worker_threads';

const m = await import(workerData.bundleUrl);

function describe(v) {
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : String(v);
  if (typeof v === 'boolean' || typeof v === 'string') return `${typeof v}:${v}`;
  if (Array.isArray(v)) return `[${v.map(describe).join(',')}]`;
  if (v && typeof v === 'object') {
    if ('re' in v && 'im' in v) return `Complex(${describe(v.re)},${describe(v.im)})`;
    if (Array.isArray(v._data)) return `Matrix${describe(v._data)}`;
    if ('value' in v) return `{value:${describe(v.value)}}`;
    return `object:${Object.keys(v).slice(0, 4).join(',')}`;
  }
  return `${typeof v}:${String(v)}`;
}

for (const job of workerData.jobs) {
  parentPort.postMessage({ type: 'start', job });
  const target = m[job.name];
  const fn = job.sig ? target.signatures[job.sig] : target;
  const args = job.args.map((a) =>
    a === 'NaN' ? NaN : a === 'Inf' ? Infinity : a === '-Inf' ? -Infinity : a
  );
  if (job.integrand) args.unshift(job.integrand === 'nan' ? () => NaN : (x) => x);
  let out;
  try {
    let r = fn(...args);
    if (r && typeof r.then === 'function') r = await r;
    out = describe(r);
  } catch (e) {
    out = `throws:${e?.constructor?.name ?? 'unknown'}`;
  }
  parentPort.postMessage({ type: 'result', job, out });
}
parentPort.postMessage({ type: 'done' });
