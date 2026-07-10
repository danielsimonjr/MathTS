/**
 * GPU Shader Manager (generic)
 *
 * Compiles and caches WGSL shader modules + compute pipelines, and holds a
 * generic name→code registry. Ships NO domain kernels — consumers register
 * their own WGSL (e.g. matrix registers its matmul/transpose/reduce shaders).
 */

import { GPUContext } from './GPUContext.js';

interface ShaderCacheEntry {
  module: GPUShaderModule;
  pipelines: Map<string, GPUComputePipeline>;
  createdAt: number;
}

/** Shader source definition. */
export interface ShaderSource {
  code: string;
  entryPoint: string;
  label?: string;
}

/** Pipeline configuration. */
export interface PipelineConfig {
  entryPoint: string;
  layout?: GPUPipelineLayout | 'auto';
  label?: string;
}

/**
 * Shader Manager for compiling and caching GPU shaders + a name→code registry.
 */
export class ShaderManager {
  private context: GPUContext;
  private cache: Map<string, ShaderCacheEntry> = new Map();
  private registered: Map<string, string> = new Map();

  constructor(context: GPUContext) {
    this.context = context;
  }

  /** Get or compile a shader module by name. */
  getShaderModule(name: string, code: string): GPUShaderModule {
    const existing = this.cache.get(name);
    if (existing) {
      return existing.module;
    }

    const module = this.context.createShaderModule(code, name);
    this.cache.set(name, {
      module,
      pipelines: new Map(),
      createdAt: Date.now(),
    });
    return module;
  }

  /** Get or create a compute pipeline. */
  getPipeline(
    shaderName: string,
    entryPoint: string,
    code?: string,
    layout?: GPUPipelineLayout | 'auto'
  ): GPUComputePipeline {
    const pipelineKey = `${shaderName}:${entryPoint}`;

    let entry = this.cache.get(shaderName);
    if (entry) {
      const pipeline = entry.pipelines.get(pipelineKey);
      if (pipeline) {
        return pipeline;
      }
    } else if (code) {
      this.getShaderModule(shaderName, code);
      entry = this.cache.get(shaderName)!;
    } else {
      throw new Error(`Shader not found: ${shaderName}`);
    }

    const pipeline = this.context.createComputePipeline(
      entry.module,
      entryPoint,
      layout,
      pipelineKey
    );
    entry.pipelines.set(pipelineKey, pipeline);
    return pipeline;
  }

  /** Register a named shader's WGSL source (no compilation — pure bookkeeping). */
  registerShader(name: string, code: string): void {
    this.registered.set(name, code);
  }

  /** Whether a shader name has been registered. */
  hasRegisteredShader(name: string): boolean {
    return this.registered.has(name);
  }

  /** Get a registered shader's WGSL source (throws if unregistered). */
  getRegisteredShaderSource(name: string): string {
    const code = this.registered.get(name);
    if (!code) {
      throw new Error(`Unknown registered shader: ${name}`);
    }
    return code;
  }

  /** Compile + cache a registered shader module by name. */
  getRegisteredShaderModule(name: string): GPUShaderModule {
    return this.getShaderModule(`registered:${name}`, this.getRegisteredShaderSource(name));
  }

  /** Get or create a compute pipeline for a registered shader. */
  getRegisteredPipeline(name: string, entryPoint: string = 'main'): GPUComputePipeline {
    return this.getPipeline(`registered:${name}`, entryPoint, this.getRegisteredShaderSource(name));
  }

  /** Precompile every registered shader's module + default pipeline. */
  precompileRegistered(): void {
    for (const name of this.registered.keys()) {
      this.getRegisteredShaderModule(name);
      this.getRegisteredPipeline(name);
    }
  }

  /** Clear the compiled-shader cache (registrations are retained). */
  clearCache(): void {
    this.cache.clear();
  }

  /** Cache statistics. */
  getStats(): { cachedShaders: number; cachedPipelines: number } {
    let cachedShaders = 0;
    let cachedPipelines = 0;
    for (const entry of this.cache.values()) {
      cachedShaders++;
      cachedPipelines += entry.pipelines.size;
    }
    return { cachedShaders, cachedPipelines };
  }
}
