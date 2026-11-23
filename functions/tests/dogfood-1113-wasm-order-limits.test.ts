/**
 * #1113: the WASM Bessel and recurrence kernels use the same order limits as the JS path.
 *
 * Two layers:
 *  - The bridge tests run in this process. They replace the AS kernel with a stub that
 *    counts its calls and throws, so a bridge that wrongly calls the kernel fails at once
 *    and never hangs the run.
 *  - The kernel tests call the AS export in a child process with a time limit, because an
 *    AS kernel with no limit loops for 10 s or longer, and a loop cannot be interrupted.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  WASM_SPECIAL_THRESHOLD,
  besselJDispatch,
  besselYDispatch,
  besselJnJS,
  besselYnJS,
} from '../src/wasm/special/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls } from './helpers/wasm-spy.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';

const here = dirname(fileURLToPath(import.meta.url));
const AS_BINDINGS = resolve(here, '../../assembly/build/mathts.js');
const N = WASM_SPECIAL_THRESHOLD;

let restoreWasmPolicy = (): void => {};
beforeAll(() => {
  restoreWasmPolicy = overrideWasmPolicy({ '*': { min: 0 } });
});
afterAll(() => {
  restoreWasmPolicy();
});

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;
const describeIfBindings = existsSync(AS_BINDINGS) ? describe : describe.skip;

function filled(v: number): Float64Array {
  return new Float64Array(N).fill(v);
}

/** Run `body` with the named AS kernel replaced by a stub that counts and throws. */
function withStubbedKernel<T>(name: string, body: () => T): { result: T | Error; calls: number } {
  const real = wasmLoader.getModule() as unknown as Record<string, unknown> | null;
  if (!real) throw new Error('the AS module is not loaded');
  let calls = 0;
  const clone: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(real)) clone[key] = real[key];
  clone[name] = () => {
    calls++;
    throw new Error('stub kernel');
  };
  const original = wasmLoader.getModule.bind(wasmLoader);
  (wasmLoader as unknown as { getModule: () => unknown }).getModule = () => clone;
  try {
    return { result: body(), calls };
  } catch (e) {
    return { result: e as Error, calls };
  } finally {
    (wasmLoader as unknown as { getModule: () => unknown }).getModule = original;
  }
}

describeIfAS('#1113 bridge: the WASM kernel gets only the inputs that match the JS path', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);
  afterAll(() => {
    wasmLoader.reset();
  });

  it('besselJ over the order limit throws the RangeError of the JS path', () => {
    const { result, calls } = withStubbedKernel('bessel_jn_f64', () =>
      besselJDispatch(3_000_000_000, filled(5e9))
    );
    expect(calls).toBe(0);
    expect(result).toBeInstanceOf(RangeError);
  });

  it('besselJ with an order above the i32 range returns the JS value, not a wrapped order', () => {
    // 2.4e9 is below the JS limit; x = 1000 is in the zero bound, so the JS path returns 0 at once.
    const { result, calls } = withStubbedKernel('bessel_jn_f64', () =>
      besselJDispatch(2_400_000_000, filled(1000))
    );
    expect(calls).toBe(0);
    expect(Array.from(result as Float64Array).every((v) => v === 0)).toBe(true);
  });

  it('besselJ with a downward sweep over the limit throws the RangeError of the JS path', () => {
    const { result, calls } = withStubbedKernel('bessel_jn_f64', () =>
      besselJDispatch(1_250_000_000, filled(1_249_999_999))
    );
    expect(calls).toBe(0);
    expect(result).toBeInstanceOf(RangeError);
  });

  it('besselJ with a non-integer or non-finite order stays on the JS path', () => {
    for (const order of [2.5, NaN, Infinity]) {
      const xs = new Float64Array(N).map((_, i) => 1 + (i % 9));
      const { result, calls } = withStubbedKernel('bessel_jn_f64', () =>
        besselJDispatch(order, xs)
      );
      expect(calls, `order ${order}`).toBe(0);
      expect(Array.from(result as Float64Array)).toEqual(Array.from(besselJnJS(order, xs)));
    }
  });

  it('besselY over the order limit throws the RangeError of the JS path', () => {
    const { result, calls } = withStubbedKernel('bessel_yn_f64', () =>
      besselYDispatch(3_000_000_000, filled(5e9))
    );
    expect(calls).toBe(0);
    expect(result).toBeInstanceOf(RangeError);
  });

  it('besselY with a non-integer or non-finite order stays on the JS path', () => {
    for (const order of [2.5, NaN, Infinity]) {
      const xs = new Float64Array(N).map((_, i) => 1 + (i % 9));
      const { result, calls } = withStubbedKernel('bessel_yn_f64', () =>
        besselYDispatch(order, xs)
      );
      expect(calls, `order ${order}`).toBe(0);
      expect(Array.from(result as Float64Array)).toEqual(Array.from(besselYnJS(order, xs)));
    }
  });

  it('the stub sees a call for an order that the kernel takes (positive control)', () => {
    const xs = new Float64Array(N).map((_, i) => 1 + (i % 9));
    const { calls } = withStubbedKernel('bessel_jn_f64', () => besselJDispatch(7, xs));
    expect(calls).toBeGreaterThan(0);
  });

  it('an ordinary order still runs on the AS kernel and matches the JS value', () => {
    const xs = new Float64Array(N).map((_, i) => 0.5 + (i % 50) * 0.3);
    const j = countExportCalls(['bessel_jn_f64'], () => besselJDispatch(7, xs));
    expect(j.counts['bessel_jn_f64']).toBeGreaterThan(0);
    const jRef = besselJnJS(7, xs);
    for (let i = 0; i < N; i++) expect(j.result[i]).toBeCloseTo(jRef[i], 10);
    const y = countExportCalls(['bessel_yn_f64'], () => besselYDispatch(7, xs));
    expect(y.counts['bessel_yn_f64']).toBeGreaterThan(0);
    const yRef = besselYnJS(7, xs);
    for (let i = 0; i < N; i++) expect(y.result[i]).toBeCloseTo(yRef[i], 8);
  });
});

type KernelResult = {
  timedOut: boolean;
  ok?: boolean;
  value?: number;
  message?: string;
  ms: number;
};

/**
 * Call one AS export in a child process; the child prints one JSON line. `onArray` passes the
 * second argument as a one-element Float64Array (the array kernels), else as a number.
 */
function callKernel(
  fn: string,
  n: number,
  x: number,
  onArray = false,
  timeoutMs = 12_000
): KernelResult {
  const script = `
    const m = await import(${JSON.stringify(pathToFileURL(AS_BINDINGS).href)});
    const t = Date.now();
    try {
      const r = ${onArray}
        ? m[${JSON.stringify(fn)}](${n}, new Float64Array([${x}]))[0]
        : m[${JSON.stringify(fn)}](${n}, ${x});
      console.log(JSON.stringify({ ok: true, value: Number.isNaN(r) ? 'NaN' : r === Infinity ? 'Inf' : r === -Infinity ? '-Inf' : r, ms: Date.now() - t }));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, message: String(e && e.message), ms: Date.now() - t }));
    }`;
  const t = Date.now();
  const r = spawnSync(
    process.execPath,
    ['--max-old-space-size=300', '--input-type=module', '-e', script],
    { timeout: timeoutMs, encoding: 'utf8' }
  );
  if (r.error || r.status === null) return { timedOut: true, ms: Date.now() - t };
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  if (out.value === 'NaN') out.value = NaN;
  if (out.value === 'Inf') out.value = Infinity;
  if (out.value === '-Inf') out.value = -Infinity;
  return { timedOut: false, ...out };
}

const jn = (n: number, x: number): KernelResult => callKernel('bessel_jn_f64', n, x, true);
const yn = (n: number, x: number): KernelResult => callKernel('bessel_yn_f64', n, x, true);

describeIfBindings('#1113 kernel: the AS kernels have the limits of the JS scalars', () => {
  it('bessel_jn_f64 returns 0 at once for an order far above x (zero bound)', () => {
    const r = jn(1_000_000_000, 1e6);
    expect(r.timedOut).toBe(false);
    expect(r.value).toBe(0);
  }, 30_000);

  it('bessel_jn_f64 rescales the downward sweep like the JS scalar', () => {
    // The sweep overflowed before the rescale, so the old kernel returned NaN here.
    const r = jn(800, 300);
    expect(r.timedOut).toBe(false);
    expect(Math.abs(r.value! / 3.650293195821219e-249 - 1)).toBeLessThan(1e-9);
  }, 30_000);

  it('bessel_jn_f64 aborts when the downward sweep exceeds the limit', () => {
    const r = jn(1_250_000_000, 1_249_999_999);
    expect(r.timedOut).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sweep/);
    expect(r.ms).toBeLessThan(5_000);
  }, 30_000);

  it('bessel_jn_f64 and bessel_yn_f64 abort for the smallest i32 order', () => {
    for (const r of [jn(-2_147_483_648, 5), yn(-2_147_483_648, 5)]) {
      expect(r.timedOut).toBe(false);
      expect(r.ok).toBe(false);
    }
  }, 30_000);

  it('the orthogonal polynomial kernels abort above their limit instead of looping', () => {
    const cases: [string, number][] = [
      ['legendreP', 2_147_483_647],
      ['legendreP', 5e9],
      ['chebyshevT', 5e9],
      ['laguerreL', 1_500_000_000],
      ['hermiteH', 5e9],
    ];
    for (const [fn, n] of cases) {
      const r = callKernel(fn, n, 0.5);
      expect(r.timedOut, `${fn}(${n}) must not loop`).toBe(false);
      expect(r.ok, `${fn}(${n})`).toBe(false);
      expect(r.message, `${fn}(${n})`).toMatch(/exceeds the supported maximum/);
    }
  }, 120_000);

  it('hermiteH certifies signed overflow at high degree (#1381)', () => {
    const n = 100_000_001;
    const r = callKernel('hermiteH', n, -0.3);
    expect(r.timedOut).toBe(false);
    expect(r.value).toBe(-Infinity);
    const uncertain = callKernel('hermiteH', n, 0.995 * Math.sqrt(2 * n + 1));
    expect(uncertain.timedOut).toBe(false);
    expect(uncertain.message).toMatch(/uncertified overflow/);
  }, 30_000);

  it('a non-finite order gives NaN', () => {
    for (const fn of ['legendreP', 'chebyshevT', 'laguerreL', 'hermiteH']) {
      const r = callKernel(fn, Infinity, 0.5);
      expect(r.timedOut, fn).toBe(false);
      expect(r.value, fn).toBeNaN();
    }
  }, 60_000);

  it('ordinary orders keep their values', () => {
    expect(jn(5, 2).value).toBeCloseTo(0.007039629755871685, 12);
    expect(callKernel('chebyshevT', 10, 0.3).value).toBeCloseTo(Math.cos(10 * Math.acos(0.3)), 12);
    expect(callKernel('legendreP', 5, 0.3).value).toBeCloseTo(
      (63 * 0.3 ** 5 - 70 * 0.3 ** 3 + 15 * 0.3) / 8,
      12
    );
    expect(callKernel('laguerreL', 3, 2).value).toBeCloseTo(-1 / 3, 12);
  }, 30_000);
});

/** Encode a double so that JSON keeps -0, NaN and the infinities. */
const ENCODE = `(v) => (Object.is(v, -0) ? '-0' : String(v))`;
const decode = (v: string): number => (v === '-0' ? -0 : Number(v));
/** Format a double for a failure message; String(-0) is '0'. */
const fmt = (v: number): string => (Object.is(v, -0) ? '-0' : String(v));

/**
 * Call `bessel_jn_f64(n, xs)` once per order in a child process, with a time limit. Returns
 * the values in the order of `cases`, or null when the child timed out or failed.
 */
function jnBatch(cases: [number, number[]][], timeoutMs = 30_000): number[][] | null {
  const script = `
    const m = await import(${JSON.stringify(pathToFileURL(AS_BINDINGS).href)});
    const enc = ${ENCODE};
    const out = ${JSON.stringify(cases)}.map(([n, xs]) =>
      Array.from(m.bessel_jn_f64(n, new Float64Array(xs)), enc));
    console.log(JSON.stringify(out));`;
  const r = spawnSync(
    process.execPath,
    ['--max-old-space-size=300', '--input-type=module', '-e', script],
    { timeout: timeoutMs, encoding: 'utf8' }
  );
  if (r.error || r.status !== 0) return null;
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!) as string[][];
  return out.map((row) => row.map(decode));
}

describeIfBindings('#1113 kernel: early exits and signs match the JS scalar', () => {
  it('bessel_yn_f64 and bessel_jn_f64 of x = Infinity return the limit 0 at once', () => {
    // Before #1113 each call ran the whole recurrence: about 2 s for an order of 1e8. It then
    // stopped at the first NaN (J0 and Y0 of Infinity were NaN). Now J_n and Y_n of Infinity
    // are 0, the limit (the amplitude sqrt(2 / (pi x)) -> 0), before any loop.
    for (const r of [jn(1_000_000_000, Infinity), yn(100_000_000, Infinity)]) {
      expect(r.timedOut).toBe(false);
      expect(r.ok).toBe(true);
      expect(r.value).toBe(0);
      expect(r.ms).toBeLessThan(500);
    }
  }, 60_000);

  it('bessel_yn_f64 stops at the first overflow and returns the infinity of the JS scalar (#1289)', () => {
    // Y_n(1) is below -1.797e308 from n = 152. The kernel returned NaN from n = 154.
    for (const [n, want] of [
      [152, -Infinity],
      [154, -Infinity],
      [400, -Infinity],
      [2_147_483_647, -Infinity],
      [-401, Infinity],
      [-400, -Infinity],
    ] as [number, number][]) {
      const r = yn(n, 1);
      expect(r.timedOut, `yn(${n}, 1)`).toBe(false);
      expect(r.ok, `yn(${n}, 1)`).toBe(true);
      expect(r.value, `yn(${n}, 1)`).toBe(want);
      expect(r.ms, `yn(${n}, 1)`).toBeLessThan(500);
    }
  }, 60_000);

  it('Miller path (|x| <= |n|): the kernel is bit-identical to the JS path, signed zeros included', () => {
    const orders = [2, 3, 4, 7, 10, 37, 100, 151, 299, 300];
    const cases: [number, number[]][] = [];
    for (const m of orders) {
      for (const n of [m, -m]) {
        const xs = [0, 1e-16, 0.01, 0.1, 0.5, 0.9, 1].flatMap((f) => [f * m, -f * m]);
        cases.push([n, xs]);
      }
    }
    // Zero returns: x = 0, the zero bound and three rescales after J_n is captured.
    cases.push([-3, [0]], [-1001, [5]], [-10001, [7000]], [10000, [7000]], [800, [300]]);
    const got = jnBatch(cases);
    expect(got).not.toBeNull();
    cases.forEach(([n, xs], i) => {
      const want = besselJnJS(n, new Float64Array(xs));
      xs.forEach((x, j) => {
        expect(
          Object.is(got![i][j], want[j]),
          `J_${n}(${x}): ${fmt(got![i][j])} vs ${fmt(want[j])}`
        ).toBe(true);
      });
    });
    // The JS path gives -0 for a negative odd order, so the kernel must too.
    expect(Object.is(got![cases.length - 5][0], -0)).toBe(true);
  }, 60_000);

  it('forward path (|x| > |n|): the kernel agrees with the JS path to 1e-11 relative', () => {
    const cases: [number, number[]][] = [
      [2, [2.5, 3, 10, -7.25]],
      [5, [5.5, 10.5, 33.3, -12]],
      [20, [21, 50, 123.4]],
      [-7, [7.5, 9.1, 15, 40.2, -7.5, -9.1, -15, -40.2]],
      [-324, [-354.92, 354.92, 400]],
      [100, [101, 250, 1000]],
    ];
    const got = jnBatch(cases);
    expect(got).not.toBeNull();
    cases.forEach(([n, xs], i) => {
      const want = besselJnJS(n, new Float64Array(xs));
      xs.forEach((x, j) => {
        const err = Math.abs(got![i][j] / want[j] - 1);
        expect(err, `J_${n}(${x}): ${got![i][j]} vs ${want[j]}`).toBeLessThanOrEqual(1e-11);
      });
    });
  }, 60_000);
});

/**
 * The bridge with the real kernel runs in a Bun child (Bun loads the TypeScript source), so a
 * kernel with no NaN exit times out the child instead of hanging the run.
 */
describeIfAS('#1113 bridge: besselY with a huge order on the real kernel', () => {
  it('besselYDispatch(2e9, ones) equals the JS path and finishes', () => {
    const src = (rel: string): string => JSON.stringify(pathToFileURL(resolve(here, rel)).href);
    const script = `
      const { wasmLoader } = await import(${src('../src/wasm/WasmLoader.ts')});
      const { overrideWasmPolicy } = await import(${src('../src/wasm/policy.ts')});
      const { besselYDispatch } = await import(${src('../src/wasm/special/wasm-bridge.ts')});
      const { countExportCalls } = await import(${src('./helpers/wasm-spy.ts')});
      await wasmLoader.load(${JSON.stringify(AS_WASM_PATH)});
      overrideWasmPolicy({ '*': { min: 0 } });
      const enc = ${ENCODE};
      const r = countExportCalls(['bessel_yn_f64'], () =>
        besselYDispatch(2e9, new Float64Array(${N}).fill(1)));
      console.log(JSON.stringify({ calls: r.counts.bessel_yn_f64, values: Array.from(r.result, enc) }));`;
    const r = spawnSync('bun', ['--eval', script], {
      timeout: 60_000,
      encoding: 'utf8',
      cwd: resolve(here, '..'),
    });
    expect(r.error, r.stderr).toBeUndefined();
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout.trim().split('\n').pop()!) as {
      calls: number;
      values: string[];
    };
    expect(out.calls).toBeGreaterThan(0);
    const want = besselYnJS(2e9, filled(1));
    out.values.forEach((v, i) => expect(Object.is(decode(v), want[i])).toBe(true));
  }, 90_000);
});
