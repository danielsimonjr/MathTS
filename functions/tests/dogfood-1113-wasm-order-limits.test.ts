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
      console.log(JSON.stringify({ ok: true, value: Number.isNaN(r) ? 'NaN' : r, ms: Date.now() - t }));
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

  it('hermiteH stops at the first NaN, as the JS scalar does', () => {
    const r = callKernel('hermiteH', 1_000_000_000, 0.5);
    expect(r.timedOut).toBe(false);
    expect(r.value).toBeNaN();
    expect(r.ms).toBeLessThan(3_000);
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
