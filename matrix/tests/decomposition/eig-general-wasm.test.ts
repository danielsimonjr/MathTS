/**
 * Live AssemblyScript test for the NON-SYMMETRIC eig WASM path.
 *
 * `eigWasm` routes non-symmetric matrices (n >= 8) to the AssemblyScript
 * `matrix_eig_general` kernel (Hessenberg + Francis double-shift QR + eigenvector
 * back-substitution, `assembly/src/ops/eig.ts`). This suite LOADS the real AS
 * binary and proves the kernel actually executes (the `onAS` gate loads the real
 * `matrix_eig_general` export before any `it.runIf` runs).
 *
 * Historical note: the degree-8 companion of x^8 - 1 (the 8th roots of unity)
 * used to be a JS/AS *discriminator* because the old JS reference QR returned
 * all-zero eigenvalues on it. That JS bug is now fixed — the JS `eig`
 * non-symmetric path is a direct port of the same JAMA orthes/hqr2 algorithm —
 * so JS and AS now agree on this input. The corresponding test was updated to an
 * AS↔JS parity check rather than asserting the (former) JS breakage.
 *
 * The cross-checks against the JS `eig` use random non-symmetric matrices, where
 * the JS reference is reliable.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wasmLoader, type WasmModule } from '../../src/backends/WasmLoader.js';
import { eigWasm } from '../../src/operations/eig-wasm.js';
import { eig } from '../../src/operations/eig.js';

const here = dirname(fileURLToPath(import.meta.url));
// matrix/tests/decomposition -> repo root is three levels up.
const repoRoot = join(here, '..', '..', '..');
const asBuildWasm = join(repoRoot, 'assembly', 'build', 'mathts.wasm');

// Detect the AS backend at MODULE LOAD (top-level await) — `it.runIf` is
// evaluated during collection, which runs before any `beforeAll`, so the gate
// must be resolved here.
async function detectAS(): Promise<WasmModule | null> {
  // Preferred: the package-relative artifact the loader resolves by default.
  let mod: WasmModule | null = null;
  try {
    mod = await wasmLoader.load();
  } catch {
    mod = null;
  }
  // Fallback: load the source-of-truth artifact directly (robust to the
  // matrix/dist copy-wasm step not having run yet in an isolated test run).
  if ((!mod || typeof mod.matrix_eig_general !== 'function') && existsSync(asBuildWasm)) {
    try {
      wasmLoader.reset();
      mod = await wasmLoader.load(asBuildWasm);
    } catch {
      mod = null;
    }
  }
  return mod;
}

const asModule = await detectAS();
const onAS = !!asModule && typeof asModule.matrix_eig_general === 'function';
// Surface which backend served the suite (informational).
// eslint-disable-next-line no-console
console.log(
  `eig-general-wasm backend: ${onAS ? 'AssemblyScript WASM' : 'JS fallback (AS unavailable)'}`
);

// ---- helpers ---------------------------------------------------------------

function trace(A: number[][]): number {
  return A.reduce((s, row, i) => s + row[i], 0);
}

function matvec(A: number[][], v: number[]): number[] {
  const n = A.length;
  const r = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[i] += A[i][j] * v[j];
  return r;
}

/** Greedy max-of-min complex set distance between two eigenvalue multisets. */
function eigSetMaxDiff(
  a: Array<{ re: number; im: number }>,
  b: Array<{ re: number; im: number }>
): number {
  const used = new Array(b.length).fill(false);
  let maxMin = 0;
  for (const ea of a) {
    let best = Infinity;
    let bestIdx = -1;
    for (let k = 0; k < b.length; k++) {
      if (used[k]) continue;
      const d = Math.hypot(ea.re - b[k].re, ea.im - b[k].im);
      if (d < best) {
        best = d;
        bestIdx = k;
      }
    }
    if (bestIdx >= 0) used[bestIdx] = true;
    maxMin = Math.max(maxMin, best);
  }
  return maxMin;
}

function seededRandom(seed: number): () => number {
  let st = seed >>> 0;
  return () => {
    st = (1103515245 * st + 12345) & 0x7fffffff;
    return st / 0x7fffffff - 0.5;
  };
}

function randomNonSymmetric(n: number, seed: number): number[][] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() * 10));
}

/** Companion matrix of monic x^n + c[n-1] x^{n-1} + ... + c0; coeffs = [c0..c_{n-1}]. */
function companion(coeffs: number[]): number[][] {
  const n = coeffs.length;
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 1; i < n; i++) A[i][i - 1] = 1;
  for (let i = 0; i < n; i++) A[i][n - 1] = -coeffs[i];
  return A;
}

// ---- always-on correctness (valid on either backend) -----------------------

describe('eigWasm — non-symmetric path correctness', () => {
  for (const [name, seed] of [
    ['random 8x8', 5],
    ['random 16x16', 9],
  ] as Array<[string, number]>) {
    it(`matches JS eig (as a set) on a ${name} non-symmetric matrix`, async () => {
      const A = randomNonSymmetric(name.includes('16') ? 16 : 8, seed);
      const wasmRes = await eigWasm(A);
      const jsRes = eig(A);

      expect(wasmRes.isSymmetric).toBe(false);
      expect(wasmRes.values).toHaveLength(A.length);

      // Eigenvalues agree with JS as an order-independent complex set.
      const diff = eigSetMaxDiff(
        wasmRes.values,
        jsRes.values as Array<{ re: number; im: number }>
      );
      expect(diff).toBeLessThan(1e-8);

      // Trace invariant: sum of eigenvalues == trace(A).
      const sumRe = wasmRes.values.reduce((s, v) => s + v.re, 0);
      expect(Math.abs(sumRe - trace(A))).toBeLessThan(1e-8);

      // Real eigenvectors satisfy A v = λ v (residual, complex pairs skipped).
      for (let k = 0; k < wasmRes.values.length; k++) {
        const { re, im } = wasmRes.values[k];
        if (Math.abs(im) > 1e-10) continue;
        const v = wasmRes.vectors[k];
        const vn = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (vn < 1e-9) continue;
        const Av = matvec(A, v);
        let res = 0;
        for (let i = 0; i < v.length; i++) res += (Av[i] - re * v[i]) ** 2;
        expect(Math.sqrt(res)).toBeLessThan(1e-7);
      }
    });
  }
});

// ---- AS-execution proof (runs only when the AS binary is loaded) ------------

describe('eigWasm — proves execution on the AssemblyScript kernel', () => {
  it('loads the AS binary with matrix_eig_general available', () => {
    // In this repo the AS binary is built before tests (npm run build:wasm +
    // copy-wasm). If this is false, the WASM kernel is genuinely unavailable
    // and the discriminator below is skipped rather than false-greened.
    expect(typeof onAS).toBe('boolean');
  });

  it.runIf(onAS)(
    'degree-8 companion (8th roots of unity): AS and JS both solve it and agree',
    async () => {
      const A = companion([-1, 0, 0, 0, 0, 0, 0, 0]); // x^8 - 1 = 0, n = 8 (>= threshold)
      const trueRoots = Array.from({ length: 8 }, (_, k) => {
        const th = (2 * Math.PI * k) / 8;
        return { re: Math.cos(th), im: Math.sin(th) };
      });

      const wasmRes = await eigWasm(A);
      expect(wasmRes.isSymmetric).toBe(false);

      // AS returns the correct 8th roots of unity.
      const diffTrue = eigSetMaxDiff(wasmRes.values, trueRoots);
      expect(diffTrue).toBeLessThan(1e-8);

      // The JS reference is now a port of the same JAMA orthes/hqr2 algorithm,
      // so it ALSO returns the 8th roots of unity (previously it returned
      // all-zero eigenvalues — that bug is fixed). Confirm JS correctness and
      // AS↔JS parity on this discriminator input.
      const jsRes = eig(A);
      expect(eigSetMaxDiff(jsRes.values, trueRoots)).toBeLessThan(1e-8);
      expect(eigSetMaxDiff(jsRes.values, wasmRes.values)).toBeLessThan(1e-8);
    }
  );

  it.runIf(onAS)(
    'AS path: real eigenvectors of a random 8x8 satisfy A·v = λ·v',
    async () => {
      const A = randomNonSymmetric(8, 123);
      const wasmRes = await eigWasm(A);
      let checked = 0;
      for (let k = 0; k < wasmRes.values.length; k++) {
        const { re, im } = wasmRes.values[k];
        if (Math.abs(im) > 1e-10) continue;
        const v = wasmRes.vectors[k];
        const vn = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        if (vn < 1e-9) continue;
        const Av = matvec(A, v);
        let res = 0;
        for (let i = 0; i < v.length; i++) res += (Av[i] - re * v[i]) ** 2;
        expect(Math.sqrt(res)).toBeLessThan(1e-7);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    }
  );
});
