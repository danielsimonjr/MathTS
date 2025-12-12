/**
 * GPU Shader Manager
 *
 * Manages WGSL shader loading, compilation, and caching.
 */

import { GPUContext } from './GPUContext.js';

/**
 * Shader cache entry
 */
interface ShaderCacheEntry {
  module: GPUShaderModule;
  pipelines: Map<string, GPUComputePipeline>;
  createdAt: number;
}

/**
 * Shader source definition
 */
export interface ShaderSource {
  /** Shader WGSL code */
  code: string;
  /** Entry point name */
  entryPoint: string;
  /** Optional label for debugging */
  label?: string;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Entry point function name */
  entryPoint: string;
  /** Pipeline layout ('auto' or custom) */
  layout?: GPUPipelineLayout | 'auto';
  /** Optional label for debugging */
  label?: string;
}

/**
 * Built-in shader library
 */
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

    var<workgroup> shared: array<f32, 256>;

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
      shared[lid.x] = sum;

      workgroupBarrier();

      // Reduce within workgroup
      for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
        if (lid.x < s) {
          shared[lid.x] = shared[lid.x] + shared[lid.x + s];
        }
        workgroupBarrier();
      }

      // Write result
      if (lid.x == 0u) {
        output[wid.x] = shared[0];
      }
    }
  `,
};

/**
 * Shader Manager for compiling and caching GPU shaders
 */
export class ShaderManager {
  private context: GPUContext;
  private cache: Map<string, ShaderCacheEntry> = new Map();

  constructor(context: GPUContext) {
    this.context = context;
  }

  /**
   * Get or compile a shader module
   */
  getShaderModule(name: string, code: string): GPUShaderModule {
    // Check cache
    let entry = this.cache.get(name);
    if (entry) {
      return entry.module;
    }

    // Compile shader
    const module = this.context.createShaderModule(code, name);

    // Cache it
    entry = {
      module,
      pipelines: new Map(),
      createdAt: Date.now(),
    };
    this.cache.set(name, entry);

    return module;
  }

  /**
   * Get a builtin shader module
   */
  getBuiltinShader(name: keyof typeof BUILTIN_SHADERS): GPUShaderModule {
    const code = BUILTIN_SHADERS[name];
    if (!code) {
      throw new Error(`Unknown builtin shader: ${name}`);
    }
    return this.getShaderModule(`builtin:${name}`, code);
  }

  /**
   * Get or create a compute pipeline
   */
  getPipeline(
    shaderName: string,
    entryPoint: string,
    code?: string,
    layout?: GPUPipelineLayout | 'auto'
  ): GPUComputePipeline {
    const pipelineKey = `${shaderName}:${entryPoint}`;

    // Check if shader is cached
    let entry = this.cache.get(shaderName);
    if (entry) {
      // Check if pipeline is cached
      const pipeline = entry.pipelines.get(pipelineKey);
      if (pipeline) {
        return pipeline;
      }
    } else if (code) {
      // Compile shader first
      this.getShaderModule(shaderName, code);
      entry = this.cache.get(shaderName)!;
    } else {
      throw new Error(`Shader not found: ${shaderName}`);
    }

    // Create pipeline
    const pipeline = this.context.createComputePipeline(
      entry.module,
      entryPoint,
      layout,
      pipelineKey
    );

    entry.pipelines.set(pipelineKey, pipeline);

    return pipeline;
  }

  /**
   * Get a builtin compute pipeline
   */
  getBuiltinPipeline(
    name: keyof typeof BUILTIN_SHADERS,
    entryPoint: string = 'main'
  ): GPUComputePipeline {
    const shaderName = `builtin:${name}`;
    const code = BUILTIN_SHADERS[name];

    return this.getPipeline(shaderName, entryPoint, code);
  }

  /**
   * Precompile all builtin shaders
   */
  precompileBuiltins(): void {
    for (const name of Object.keys(BUILTIN_SHADERS)) {
      this.getBuiltinShader(name as keyof typeof BUILTIN_SHADERS);
      this.getBuiltinPipeline(name as keyof typeof BUILTIN_SHADERS);
    }
  }

  /**
   * Clear shader cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cachedShaders: number;
    cachedPipelines: number;
  } {
    let cachedShaders = 0;
    let cachedPipelines = 0;

    for (const entry of this.cache.values()) {
      cachedShaders++;
      cachedPipelines += entry.pipelines.size;
    }

    return { cachedShaders, cachedPipelines };
  }
}
