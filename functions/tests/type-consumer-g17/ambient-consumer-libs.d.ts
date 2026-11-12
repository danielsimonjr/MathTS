/** Minimal lib shims so issue repro fixtures typecheck with `skipLibCheck: false` and no optional installs. */
export {};

declare global {
  namespace WebAssembly {
    type ModuleImports = Record<string, unknown>;
    type Imports = Record<string, unknown>;
    interface Module {}
    interface Memory {}
    interface Instance {
      readonly exports: Record<string, unknown>;
    }
  }

  type Worker = object;
  type WorkerOptions = object;
  type Transferable = object;

  type GPUBuffer = object;
  type GPUBufferUsageFlags = number;
  type GPUCommandEncoder = object;
  type GPUCommandBuffer = object;
  type GPUShaderModule = object;
  type GPUPipelineLayout = object;
  type GPUComputePipeline = object;
  type GPUBindGroupLayout = object;
  type GPUBindGroupEntry = object;
  type GPUBindGroup = object;
  type GPURequestAdapterOptions = object;
  type GPUAdapter = object;
  type GPUDevice = object;
  type GPUQueue = object;
  type GPUFeatureName = string;
  type GPUDeviceLostReason = string;
}
