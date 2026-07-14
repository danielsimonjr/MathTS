/**
 * Browser WebGPU gate — runs REAL compute shaders on a REAL adapter.
 *
 * History: this suite used to pass without ever executing a WGSL kernel, for
 * two independent reasons — (1) it ran under Playwright's bundled
 * `chrome-headless-shell`, which has no GPU adapter, so `requestAdapter()`
 * resolved to `null`, and (2) its 4x4 matrix sat far below the 65,536-element
 * GPU threshold, so even with an adapter it took the CPU path. Both failure
 * modes were swallowed by a `catch` that "passed trivially". A gate that
 * cannot fail proves nothing.
 *
 * Now: `vitest.config.browser.ts` launches the SYSTEM Chrome (real adapter),
 * the matmul is sized ABOVE the GPU threshold so the WGSL kernel actually
 * dispatches, and when no adapter is present the GPU tests are SKIPPED loudly
 * rather than reported as passing.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix, gpuMatrixBackend, BUILTIN_SHADERS } from '@danielsimonjr/mathts-matrix';
import { getGlobalGPUContext } from '@danielsimonjr/mathts-gpu';
import { gpuMatmul } from '../src/typed/gpu.js';

/** f32 carries ~7 significant digits; allow for accumulation over K terms. */
// Adapter-aware: WGSL only guarantees sin/cos to ~4.9e-4 ABSOLUTE error, and
// SwiftShader (CI) uses that allowance where NVIDIA does not. See
// helpers/gpu-hardware.ts — the bound comes from the spec, not from one vendor.
import { F32_REL_TOL } from './helpers/gpu-hardware.js';

/**
 * `GPUMatrixBackend.multiplyAsync` gates the GPU on
 * `elementCount = rows * cols * inner >= 65_536`. 64x64 * 64x64 gives
 * 64*64*64 = 262_144 — comfortably above it, while keeping the JS reference
 * cheap enough to compute in-browser.
 */
const N = 64;

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;
const HAS_GPU = adapter !== null;

function makeMatrix(n: number, f: (i: number, j: number) => number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
}

function cpuMatmul(a: number[][], b: number[][]): number[][] {
  const m = a.length;
  const k = a[0].length;
  const n = b[0].length;
  const out = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a[i][p];
      for (let j = 0; j < n; j++) out[i][j] += aip * b[p][j];
    }
  }
  return out;
}

describe('WebGPU environment', () => {
  it('reports whether a real GPU adapter is present', () => {
    if (HAS_GPU) {
      const info = adapter!.info ?? ({} as GPUAdapterInfo);
      console.log(`[gpu] adapter present: vendor=${info.vendor} architecture=${info.architecture}`);
    } else {
      console.warn('[gpu] NO WebGPU adapter — GPU kernel tests are SKIPPED, not verified.');
    }
    expect(typeof HAS_GPU).toBe('boolean');
  });
});

describe.skipIf(!HAS_GPU)('WebGPU kernels execute on a real adapter', () => {
  /**
   * Regression guard for a class of bug that was previously SILENT: a builtin
   * WGSL kernel that fails to compile emits an *uncaptured* GPUValidationError
   * and leaves that shader permanently unusable, but nothing failed — so it
   * went unnoticed. (`sumReduce` shipped naming a workgroup array `shared`,
   * which is a RESERVED KEYWORD in WGSL; it never compiled.)
   *
   * `GPUBackend.initialize()` precompiles every registered builtin, so asserting
   * that init produces zero validation errors compiles-checks all of them.
   */
  it('every builtin WGSL shader compiles cleanly', async () => {
    await gpuMatrixBackend.initialize();
    const device = getGlobalGPUContext().getDevice();

    const failures: string[] = [];

    for (const [name, code] of Object.entries(BUILTIN_SHADERS)) {
      const info = await device.createShaderModule({ code, label: name }).getCompilationInfo();
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          failures.push(`${name} (${msg.lineNum}:${msg.linePos}): ${msg.message}`);
        }
      }
    }

    if (failures.length > 0) {
      console.error(`[gpu] WGSL compile errors:\n  - ${failures.join('\n  - ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('runs a raw WGSL compute shader (proves the harness dispatches kernels)', async () => {
    const device = await adapter!.requestDevice();
    const input = new Float32Array([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    const bytes = input.byteLength;

    const module = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> inp: array<f32>;
        @group(0) @binding(1) var<storage, read_write> outp: array<f32>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
          let i = gid.x;
          if (i >= arrayLength(&inp)) { return; }
          outp[i] = exp(sin(inp[i]));
        }
      `,
    });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });

    const inBuf = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const outBuf = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const staging = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(inBuf, 0, input);
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf } },
        { binding: 1, resource: { buffer: outBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(outBuf, 0, staging, 0, bytes);
    device.queue.submit([encoder.finish()]);

    await staging.mapAsync(GPUMapMode.READ);
    const got = new Float32Array(staging.getMappedRange().slice(0));
    staging.unmap();

    // Oracle: the closed-form composition, computed independently in f64.
    // RELATIVE error — the right metric for f32, and the one the tolerance is
    // expressed in. (`toBeCloseTo(_, 4)` is an ABSOLUTE 5e-5 bound, which
    // SwiftShader's conformant-but-loose `sin` legitimately exceeds.)
    input.forEach((x, i) => {
      const want = Math.exp(Math.sin(x));
      expect(Math.abs(got[i] - want) / Math.abs(want)).toBeLessThan(F32_REL_TOL);
    });
  });

  it(`gpuMatmul dispatches the WGSL kernel above the GPU threshold (${N}x${N})`, async () => {
    // IRRATIONAL, non-integer operands on purpose. Integers below 2^24 are
    // represented EXACTLY in f32, so an integer-valued matmul yields the same
    // answer on the f32 GPU and the f64 CPU — a zero relative error would then
    // prove nothing about which path ran. With irrational inputs the f32 GPU
    // path MUST accumulate rounding (~1e-7), while the f64 CPU fallback would
    // reproduce the f64 reference exactly (error identically 0). The error is
    // therefore a discriminator: it must be non-zero AND small.
    const aData = makeMatrix(N, (i, j) => Math.sin(i + 1) * Math.sqrt(j + 2));
    const bData = makeMatrix(N, (i, j) => Math.cos(j + 1) * Math.sqrt(i + 3));

    const result = await gpuMatmul(new DenseMatrix(N, N, aData), new DenseMatrix(N, N, bData));
    const expected = cpuMatmul(aData, bData);

    expect(result.rows).toBe(N);
    expect(result.cols).toBe(N);

    let maxRelErr = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const got = result.get(i, j);
        const want = expected[i][j];
        const denom = Math.max(1, Math.abs(want));
        maxRelErr = Math.max(maxRelErr, Math.abs(got - want) / denom);
      }
    }
    console.log(`[gpu] gpuMatmul ${N}x${N} max relative error vs f64 CPU reference: ${maxRelErr}`);

    // Correct to f32 precision...
    expect(maxRelErr).toBeLessThan(F32_REL_TOL);
    // ...and genuinely computed in f32 on the GPU, not silently on the f64 CPU.
    expect(maxRelErr).toBeGreaterThan(0);
  });
});
