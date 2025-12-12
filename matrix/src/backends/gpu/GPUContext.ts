/**
 * WebGPU Context Management
 *
 * Manages WebGPU device, queue, and command encoding.
 */

import {
  hasWebGPU,
  getGPUAdapter,
  detectGPUCapabilities,
  type GPUCapabilities,
} from './detect.js';

/**
 * Options for GPUContext initialization
 */
export interface GPUContextOptions {
  /** Prefer high-performance GPU */
  preferHighPerformance?: boolean;
  /** Required features for the device */
  requiredFeatures?: GPUFeatureName[];
  /** Required limits for the device */
  requiredLimits?: Record<string, number>;
  /** Label for debugging */
  label?: string;
}

/**
 * Status of the GPU context
 */
export type GPUContextStatus = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'lost';

/**
 * Event emitted when device is lost
 */
export interface DeviceLostEvent {
  reason: GPUDeviceLostReason;
  message: string;
}

/**
 * GPU Context manages the lifecycle of WebGPU resources
 */
export class GPUContext {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private _status: GPUContextStatus = 'uninitialized';
  private _capabilities: GPUCapabilities | null = null;
  private _lastError: Error | null = null;
  private deviceLostCallbacks: Array<(event: DeviceLostEvent) => void> = [];
  private label: string;

  constructor(options: GPUContextOptions = {}) {
    this.label = options.label || 'MathTS-GPUContext';
  }

  /**
   * Get the current status
   */
  get status(): GPUContextStatus {
    return this._status;
  }

  /**
   * Check if context is ready
   */
  get isReady(): boolean {
    return this._status === 'ready' && this.device !== null;
  }

  /**
   * Get the GPU device (throws if not initialized)
   */
  getDevice(): GPUDevice {
    if (!this.device) {
      throw new Error('GPUContext not initialized. Call initialize() first.');
    }
    return this.device;
  }

  /**
   * Get the GPU queue
   */
  getQueue(): GPUQueue {
    return this.getDevice().queue;
  }

  /**
   * Get capabilities
   */
  get capabilities(): GPUCapabilities | null {
    return this._capabilities;
  }

  /**
   * Get last error
   */
  get lastError(): Error | null {
    return this._lastError;
  }

  /**
   * Initialize the GPU context
   */
  async initialize(options: GPUContextOptions = {}): Promise<boolean> {
    if (this._status === 'ready') {
      return true;
    }

    if (this._status === 'initializing') {
      throw new Error('Already initializing');
    }

    this._status = 'initializing';

    try {
      // Check WebGPU support
      if (!hasWebGPU()) {
        throw new Error('WebGPU is not supported in this environment');
      }

      // Detect capabilities
      this._capabilities = await detectGPUCapabilities(
        options.preferHighPerformance ?? true
      );

      if (!this._capabilities.supported) {
        throw new Error('WebGPU adapter not available');
      }

      // Get adapter
      this.adapter = await getGPUAdapter({
        powerPreference: options.preferHighPerformance
          ? 'high-performance'
          : 'low-power',
      });

      if (!this.adapter) {
        throw new Error('Failed to get GPU adapter');
      }

      // Request device with required features and limits
      const deviceDescriptor: GPUDeviceDescriptor = {
        label: this.label,
        requiredFeatures: options.requiredFeatures || [],
        requiredLimits: options.requiredLimits || {},
      };

      this.device = await this.adapter.requestDevice(deviceDescriptor);

      if (!this.device) {
        throw new Error('Failed to get GPU device');
      }

      // Setup device lost handler
      this.device.lost.then((info) => {
        this._status = 'lost';
        const event: DeviceLostEvent = {
          reason: info.reason,
          message: info.message,
        };
        this.deviceLostCallbacks.forEach((cb) => cb(event));
      });

      // Setup error handler
      this.device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
        console.error('GPU uncaptured error:', event.error);
        // Wrap GPUError in a standard Error for consistent error handling
        this._lastError = new Error(`GPU Error: ${event.error.message}`);
      };

      this._status = 'ready';
      return true;
    } catch (error) {
      this._status = 'error';
      this._lastError = error as Error;
      return false;
    }
  }

  /**
   * Register callback for device lost event
   */
  onDeviceLost(callback: (event: DeviceLostEvent) => void): void {
    this.deviceLostCallbacks.push(callback);
  }

  /**
   * Create a command encoder
   */
  createCommandEncoder(label?: string): GPUCommandEncoder {
    return this.getDevice().createCommandEncoder({
      label: label || `${this.label}-CommandEncoder`,
    });
  }

  /**
   * Create a buffer
   */
  createBuffer(
    size: number,
    usage: GPUBufferUsageFlags,
    label?: string,
    mappedAtCreation: boolean = false
  ): GPUBuffer {
    return this.getDevice().createBuffer({
      label: label || `${this.label}-Buffer`,
      size,
      usage,
      mappedAtCreation,
    });
  }

  /**
   * Create a storage buffer for compute operations
   */
  createStorageBuffer(
    size: number,
    label?: string,
    readable: boolean = true,
    writable: boolean = true
  ): GPUBuffer {
    let usage = GPUBufferUsage.STORAGE;
    if (readable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    if (writable) {
      usage |= GPUBufferUsage.COPY_DST;
    }
    return this.createBuffer(size, usage, label);
  }

  /**
   * Create a staging buffer for reading back data
   */
  createStagingBuffer(size: number, label?: string): GPUBuffer {
    return this.createBuffer(
      size,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label
    );
  }

  /**
   * Create a compute pipeline
   */
  createComputePipeline(
    shaderModule: GPUShaderModule,
    entryPoint: string,
    layout?: GPUPipelineLayout | 'auto',
    label?: string
  ): GPUComputePipeline {
    return this.getDevice().createComputePipeline({
      label: label || `${this.label}-ComputePipeline`,
      layout: layout || 'auto',
      compute: {
        module: shaderModule,
        entryPoint,
      },
    });
  }

  /**
   * Create a shader module from WGSL source
   */
  createShaderModule(code: string, label?: string): GPUShaderModule {
    return this.getDevice().createShaderModule({
      label: label || `${this.label}-ShaderModule`,
      code,
    });
  }

  /**
   * Create a bind group
   */
  createBindGroup(
    layout: GPUBindGroupLayout,
    entries: GPUBindGroupEntry[],
    label?: string
  ): GPUBindGroup {
    return this.getDevice().createBindGroup({
      label: label || `${this.label}-BindGroup`,
      layout,
      entries,
    });
  }

  /**
   * Submit commands to the GPU queue
   */
  submitCommands(commandBuffers: GPUCommandBuffer[]): void {
    this.getQueue().submit(commandBuffers);
  }

  /**
   * Write data to a buffer
   */
  writeBuffer(
    buffer: GPUBuffer,
    data: ArrayBufferView | ArrayBuffer | SharedArrayBuffer,
    bufferOffset: number = 0,
    dataOffset?: number,
    size?: number
  ): void {
    // Cast to BufferSource for the WebGPU API
    this.getQueue().writeBuffer(
      buffer,
      bufferOffset,
      data as BufferSource,
      dataOffset,
      size
    );
  }

  /**
   * Read data from a buffer (async)
   */
  async readBuffer(
    buffer: GPUBuffer,
    offset: number = 0,
    size?: number
  ): Promise<ArrayBuffer> {
    const readSize = size ?? buffer.size - offset;

    // Create staging buffer
    const stagingBuffer = this.createStagingBuffer(readSize);

    // Copy to staging buffer
    const encoder = this.createCommandEncoder();
    encoder.copyBufferToBuffer(buffer, offset, stagingBuffer, 0, readSize);
    this.submitCommands([encoder.finish()]);

    // Map and read
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = stagingBuffer.getMappedRange().slice(0);
    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return data;
  }

  /**
   * Dispatch a compute shader
   */
  dispatchCompute(
    pipeline: GPUComputePipeline,
    bindGroups: GPUBindGroup[],
    workgroupCounts: [number, number, number]
  ): void {
    const encoder = this.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    bindGroups.forEach((bg, i) => pass.setBindGroup(i, bg));
    pass.dispatchWorkgroups(...workgroupCounts);
    pass.end();

    this.submitCommands([encoder.finish()]);
  }

  /**
   * Wait for all GPU operations to complete
   */
  async waitForCompletion(): Promise<void> {
    await this.getQueue().onSubmittedWorkDone();
  }

  /**
   * Destroy the context and release resources
   */
  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this._status = 'uninitialized';
    this._capabilities = null;
    this.deviceLostCallbacks = [];
  }
}

/**
 * Global GPU context instance
 */
let globalContext: GPUContext | null = null;

/**
 * Get the global GPU context
 */
export function getGlobalGPUContext(): GPUContext {
  if (!globalContext) {
    globalContext = new GPUContext({ label: 'MathTS-Global' });
  }
  return globalContext;
}

/**
 * Initialize the global GPU context
 */
export async function initializeGlobalGPU(
  options?: GPUContextOptions
): Promise<boolean> {
  const ctx = getGlobalGPUContext();
  return ctx.initialize(options);
}

/**
 * Destroy the global GPU context
 */
export function destroyGlobalGPU(): void {
  if (globalContext) {
    globalContext.destroy();
    globalContext = null;
  }
}
