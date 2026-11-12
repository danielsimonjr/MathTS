/**
 * Isolated Node gate for #712: sort(number[]) vs Float64Array.sort.
 * stdout: one JSON line { ratio, sortMs, nativeMs }.
 */
import { sort } from '../../dist/index.js';

const n = 100_000;
const src = [];
for (let i = 0; i < n; i++) src.push(Math.sin(i));

function median(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function timeNative() {
  const t0 = performance.now();
  const f = new Float64Array(src);
  f.sort();
  const sum = f[0] + f[n - 1];
  return { ms: performance.now() - t0, sum };
}

function timeSort() {
  const t0 = performance.now();
  const b = src.slice();
  sort(b);
  const sum = b[0] + b[n - 1];
  return { ms: performance.now() - t0, sum };
}

for (let w = 0; w < 10; w++) {
  if (w % 2 === 0) {
    timeSort();
    timeNative();
  } else {
    timeNative();
    timeSort();
  }
}

const sortTimes = [];
const nativeTimes = [];
const ratios = [];
let checksum = 0;
for (let r = 0; r < 11; r++) {
  const sortFirst = r % 2 === 0;
  let sortMs;
  let nativeMs;
  if (sortFirst) {
    const s = timeSort();
    const t = timeNative();
    sortMs = s.ms;
    nativeMs = t.ms;
    checksum += s.sum + t.sum;
  } else {
    const t = timeNative();
    const s = timeSort();
    nativeMs = t.ms;
    sortMs = s.ms;
    checksum += s.sum + t.sum;
  }
  sortTimes.push(sortMs);
  nativeTimes.push(nativeMs);
  ratios.push(sortMs / nativeMs);
}

const ratio = median(ratios);
process.stdout.write(
  JSON.stringify({
    ratio,
    sortMs: median(sortTimes),
    nativeMs: median(nativeTimes),
    checksum,
  }) + '\n'
);
