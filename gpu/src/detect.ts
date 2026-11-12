/**
 * WebGPU Detection and Capability Checking
 *
 * Provides runtime detection of WebGPU support and adapter capabilities.
 */

/**
 * WebGPU adapter information
 */
export interface GPUAdapterInfo {
  /** Adapter vendor */
  vendor: string;
  /** Adapter architecture */
  architecture: string;
  /** Device description */
  device: string;
  /** Driver description */
  description: string;
}

/**
 * WebGPU capability information
 */
export interface GPUCapabilities {
  /** Whether WebGPU is supported */
  supported: boolean;
  /** Adapter information if available */
  adapterInfo: GPUAdapterInfo | null;
  /** Maximum buffer size in bytes */
  maxBufferSize: number;
  /** Maximum compute workgroup size */
  maxWorkgroupSize: [number, number, number];
  /** Maximum storage buffer binding size */
  maxStorageBufferBindingSize: number;
  /** Maximum compute invocations per workgroup */
  maxComputeInvocationsPerWorkgroup: number;
  /** Maximum workgroups per dimension */
  maxComputeWorkgroupsPerDimension: number;
  /** Whether the adapter is a fallback/software adapter */
  isFallbackAdapter: boolean;
  /** Supported features */
  features: string[];
}

/**
 * Default capabilities when WebGPU is not supported
 */
const NO_WEBGPU_CAPABILITIES: GPUCapabilities = {
  supported: false,
  adapterInfo: null,
  maxBufferSize: 0,
  maxWorkgroupSize: [0, 0, 0],
  maxStorageBufferBindingSize: 0,
  maxComputeInvocationsPerWorkgroup: 0,
  maxComputeWorkgroupsPerDimension: 0,
  isFallbackAdapter: false,
  features: [],
};

/** After a failed adapter request, `hasWebGPU()` reports false (quiet fallback). */
let webgpuAdapterAvailable: boolean | null = null;

/** Opt-in console warning when the adapter is missing. Off so Node stays quiet. */
let warnOnUnavailable = false;
let warnedUnavailable = false;

/**
 * Log once when WebGPU is missing. Default is silent; status stays the record.
 */
export function enableGpuUnavailableWarnings(): void {
  warnOnUnavailable = true;
}

/** Turn the unavailable warning back off and allow a future warning. */
export function disableGpuUnavailableWarnings(): void {
  warnOnUnavailable = false;
  warnedUnavailable = false;
}

/**
 * Whether the WebGPU API surface is present (`navigator.gpu`), without proving an adapter.
 */
export function hasWebGPUSurface(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return 'gpu' in navigator;
}

/**
 * Clear cached adapter availability (tests and device reset).
 */
export function resetWebGPUAvailabilityCache(): void {
  webgpuAdapterAvailable = null;
}

/**
 * Record that `requestAdapter()` returned no adapter so feature detection stays honest.
 */
export function markWebGPUAdapterUnavailable(): void {
  webgpuAdapterAvailable = false;
  if (warnOnUnavailable && !warnedUnavailable) {
    warnedUnavailable = true;
    console.warn(
      'WebGPU adapter unavailable; staying on the CPU path (GPUContext.status "unavailable").'
    );
  }
}

/**
 * Record a successful adapter request (used after init or explicit probe).
 */
export function markWebGPUAdapterAvailable(): void {
  webgpuAdapterAvailable = true;
}

/**
 * Check if WebGPU is available in the current environment
 */
export function hasWebGPU(): boolean {
  if (!hasWebGPUSurface()) {
    return false;
  }
  if (webgpuAdapterAvailable === false) {
    return false;
  }
  return true;
}

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

/**
 * Get WebGPU adapter
 * @param options - Adapter request options
 */
export async function getGPUAdapter(
  options?: GPURequestAdapterOptions
): Promise<GPUAdapter | null> {
  if (!hasWebGPUSurface()) {
    return null;
  }

  // A rejection is a real failure (invalid options, security error). Only a
  // resolved `null` means "no adapter" — callers must not treat those alike.
  const adapter = await navigator.gpu.requestAdapter(options);
  if (adapter) markWebGPUAdapterAvailable();
  else markWebGPUAdapterUnavailable();
  return adapter;
}

/**
 * Read limits and adapter info into the public capabilities object.
 * Shared by detection and `GPUContext` so init requests the adapter once.
 */
export function capabilitiesFromAdapter(adapter: GPUAdapter): GPUCapabilities {
  const info = adapter.info;
  const limits = adapter.limits;
  return {
    supported: true,
    adapterInfo: {
      vendor: info?.vendor || 'unknown',
      architecture: info?.architecture || 'unknown',
      device: info?.device || 'unknown',
      description: info?.description || 'unknown',
    },
    maxBufferSize: limits.maxBufferSize,
    maxWorkgroupSize: [
      limits.maxComputeWorkgroupSizeX,
      limits.maxComputeWorkgroupSizeY,
      limits.maxComputeWorkgroupSizeZ,
    ],
    maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
    maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
    maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
    isFallbackAdapter:
      (adapter as unknown as { isFallbackAdapter?: boolean }).isFallbackAdapter ?? false,
    features: Array.from(adapter.features),
  };
}

/**
 * Detect WebGPU capabilities
 * @param preferHighPerformance - Whether to prefer high-performance GPU
 */
export async function detectGPUCapabilities(
  preferHighPerformance: boolean = true
): Promise<GPUCapabilities> {
  if (!hasWebGPUSurface()) {
    return NO_WEBGPU_CAPABILITIES;
  }

  const adapter = await getGPUAdapter({
    powerPreference: preferHighPerformance ? 'high-performance' : 'low-power',
  });
  if (!adapter) return NO_WEBGPU_CAPABILITIES;
  return capabilitiesFromAdapter(adapter);
}

/**
 * Check if GPU is suitable for matrix operations
 * Synchronous. Pass the object from `detectGPUCapabilities()`. Omitted
 * capabilities are the unsupported sentinel, so a zero-arg call returns false
 * instead of throwing — it does not probe the GPU.
 *
 * @param capabilities - GPU capabilities to check
 * @param minBufferSize - Minimum required buffer size (default 256MB)
 */
export function isGPUSuitableForMatrixOps(
  capabilities?: GPUCapabilities,
  minBufferSize: number = 256 * 1024 * 1024
): boolean {
  const caps = capabilities ?? NO_WEBGPU_CAPABILITIES;
  if (!caps.supported) {
    return false;
  }

  // Check minimum buffer size
  if (caps.maxBufferSize < minBufferSize) {
    return false;
  }

  // Check workgroup size (need at least 256 for efficient compute)
  const maxWorkgroupElements =
    caps.maxWorkgroupSize[0] * caps.maxWorkgroupSize[1] * caps.maxWorkgroupSize[2];
  if (maxWorkgroupElements < 256) {
    return false;
  }

  // Check storage buffer size (need at least 128MB for large matrices)
  if (caps.maxStorageBufferBindingSize < 128 * 1024 * 1024) {
    return false;
  }

  return true;
}

/**
 * Recommended workgroup size based on GPU capabilities
 */
export function getRecommendedWorkgroupSize(
  capabilities: GPUCapabilities
): [number, number, number] {
  if (!capabilities.supported) {
    return [1, 1, 1];
  }

  // For matrix operations, prefer 16x16 workgroups (256 threads)
  // This is a common choice that balances occupancy and memory access patterns
  const preferred = [16, 16, 1] as [number, number, number];

  const maxX = capabilities.maxWorkgroupSize[0];
  const maxY = capabilities.maxWorkgroupSize[1];
  const maxTotal = capabilities.maxComputeInvocationsPerWorkgroup;

  let x = Math.min(preferred[0], maxX);
  let y = Math.min(preferred[1], maxY);

  // Ensure we don't exceed max invocations
  while (x * y > maxTotal) {
    if (x > y) {
      x = Math.floor(x / 2);
    } else {
      y = Math.floor(y / 2);
    }
  }

  return [x, y, 1];
}

/**
 * Calculate maximum matrix size that can be processed on GPU
 * @param capabilities - GPU capabilities
 * @param bytesPerElement - Bytes per matrix element (default 4 for f32)
 */
export function getMaxMatrixSize(
  capabilities: GPUCapabilities,
  bytesPerElement: number = 4
): number {
  if (!capabilities.supported) {
    return 0;
  }

  // Use the smaller of max buffer size and max storage buffer binding size
  const maxBytes = Math.min(capabilities.maxBufferSize, capabilities.maxStorageBufferBindingSize);

  // Square matrix: n^2 * bytesPerElement <= maxBytes
  const maxElements = Math.floor(maxBytes / bytesPerElement);
  const maxDimension = Math.floor(Math.sqrt(maxElements));

  return maxDimension;
}
