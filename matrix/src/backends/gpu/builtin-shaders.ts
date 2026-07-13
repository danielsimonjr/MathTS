/**
 * Matrix-domain WGSL kernels.
 *
 * These live in matrix — the @danielsimonjr/mathts-gpu foundation ships no
 * domain kernels. GPUBackend registers them onto a ShaderManager at init.
 */

import type { ShaderManager } from '@danielsimonjr/mathts-gpu';

export const BUILTIN_SHADERS = {
  /** Matrix addition shader */
  matrixAdd: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>; // rows, cols, _, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] + b[idx];
    }
  `,

  /** Matrix subtraction shader */
  matrixSub: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>;

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] - b[idx];
    }
  `,

  /** Element-wise multiplication shader */
  matrixMul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>;

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      let idx = row * cols + col;
      result[idx] = a[idx] * b[idx];
    }
  `,

  /** Scalar multiplication shader */
  scalarMul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read_write> result: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<f32>; // scalar, length, _, _

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let scalar = params.x;
      let length = u32(params.y);
      let idx = gid.x;

      if (idx >= length) { return; }

      result[idx] = a[idx] * scalar;
    }
  `,

  /** Matrix multiplication (naive) shader */
  matmul: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read> b: array<f32>;
    @group(0) @binding(2) var<storage, read_write> result: array<f32>;
    @group(0) @binding(3) var<uniform> params: vec4<u32>; // M, N, K, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let M = params.x;
      let N = params.y;
      let K = params.z;
      let row = gid.y;
      let col = gid.x;

      if (row >= M || col >= N) { return; }

      var sum: f32 = 0.0;
      for (var k: u32 = 0u; k < K; k = k + 1u) {
        sum = sum + a[row * K + k] * b[k * N + col];
      }

      result[row * N + col] = sum;
    }
  `,

  /** Matrix transpose shader */
  transpose: `
    @group(0) @binding(0) var<storage, read> a: array<f32>;
    @group(0) @binding(1) var<storage, read_write> result: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // rows, cols, _, _

    @compute @workgroup_size(16, 16)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let rows = params.x;
      let cols = params.y;
      let row = gid.y;
      let col = gid.x;

      if (row >= rows || col >= cols) { return; }

      result[col * rows + row] = a[row * cols + col];
    }
  `,

  /** Sum reduction shader (first pass) */
  sumReduce: `
    @group(0) @binding(0) var<storage, read> input: array<f32>;
    @group(0) @binding(1) var<storage, read_write> output: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // inputLength, outputLength, _, _

    // NOTE: 'shared' is a RESERVED KEYWORD in WGSL — naming this workgroup
    // array 'shared' made this shader fail to compile, which (because
    // GPUBackend.initialize() precompiles every registered shader) poisoned
    // backend init and silently forced ALL GPU ops onto the CPU fallback.
    var<workgroup> sdata: array<f32, 256>;

    @compute @workgroup_size(256)
    fn main(
      @builtin(local_invocation_id) lid: vec3<u32>,
      @builtin(workgroup_id) wid: vec3<u32>
    ) {
      let inputLength = params.x;
      let idx = wid.x * 512u + lid.x;

      // Load two elements and sum
      var sum: f32 = 0.0;
      if (idx < inputLength) {
        sum = input[idx];
      }
      if (idx + 256u < inputLength) {
        sum = sum + input[idx + 256u];
      }
      sdata[lid.x] = sum;

      workgroupBarrier();

      // Reduce within workgroup
      for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
        if (lid.x < s) {
          sdata[lid.x] = sdata[lid.x] + sdata[lid.x + s];
        }
        workgroupBarrier();
      }

      // Write result
      if (lid.x == 0u) {
        output[wid.x] = sdata[0];
      }
    }
  `,
} as const;

/** Register every builtin matrix kernel onto a ShaderManager. */
export function registerBuiltinShaders(sm: ShaderManager): void {
  for (const [name, code] of Object.entries(BUILTIN_SHADERS)) {
    sm.registerShader(name, code);
  }
}
