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

/**
 * Check if WebGPU is available in the current environment
 */
export function hasWebGPU(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return 'gpu' in navigator;
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
  if (!hasWebGPU()) {
    return null;
  }

  try {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter(options);
    return adapter;
  } catch {
    return null;
  }
}

/**
 * Detect WebGPU capabilities
 * @param preferHighPerformance - Whether to prefer high-performance GPU
 */
export async function detectGPUCapabilities(
  preferHighPerformance: boolean = true
): Promise<GPUCapabilities> {
  if (!hasWebGPU()) {
    return NO_WEBGPU_CAPABILITIES;
  }

  try {
    const gpu = navigator.gpu;

    // Request adapter with preferred power preference
    const adapter = await gpu.requestAdapter({
      powerPreference: preferHighPerformance ? 'high-performance' : 'low-power',
    });

    if (!adapter) {
      return NO_WEBGPU_CAPABILITIES;
    }

    // Get adapter info
    const info = adapter.info || ({} as GPUAdapterInfo);
    const adapterInfo: GPUAdapterInfo = {
      vendor: info.vendor || 'unknown',
      architecture: info.architecture || 'unknown',
      device: info.device || 'unknown',
      description: info.description || 'unknown',
    };

    // Get limits
    const limits = adapter.limits;

    // Get features
    const features = Array.from(adapter.features);

    return {
      supported: true,
      adapterInfo,
      maxBufferSize: limits.maxBufferSize,
      maxWorkgroupSize: [
        limits.maxComputeWorkgroupSizeX,
        limits.maxComputeWorkgroupSizeY,
        limits.maxComputeWorkgroupSizeZ,
      ],
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
      isFallbackAdapter: (adapter as unknown as { isFallbackAdapter?: boolean }).isFallbackAdapter ?? false,
      features,
    };
  } catch {
    return NO_WEBGPU_CAPABILITIES;
  }
}

/**
 * Check if GPU is suitable for matrix operations
 * @param capabilities - GPU capabilities to check
 * @param minBufferSize - Minimum required buffer size (default 256MB)
 */
export function isGPUSuitableForMatrixOps(
  capabilities: GPUCapabilities,
  minBufferSize: number = 256 * 1024 * 1024
): boolean {
  if (!capabilities.supported) {
    return false;
  }

  // Check minimum buffer size
  if (capabilities.maxBufferSize < minBufferSize) {
    return false;
  }

  // Check workgroup size (need at least 256 for efficient compute)
  const maxWorkgroupElements =
    capabilities.maxWorkgroupSize[0] *
    capabilities.maxWorkgroupSize[1] *
    capabilities.maxWorkgroupSize[2];
  if (maxWorkgroupElements < 256) {
    return false;
  }

  // Check storage buffer size (need at least 128MB for large matrices)
  if (capabilities.maxStorageBufferBindingSize < 128 * 1024 * 1024) {
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
  const maxBytes = Math.min(
    capabilities.maxBufferSize,
    capabilities.maxStorageBufferBindingSize
  );

  // Square matrix: n^2 * bytesPerElement <= maxBytes
  const maxElements = Math.floor(maxBytes / bytesPerElement);
  const maxDimension = Math.floor(Math.sqrt(maxElements));

  return maxDimension;
}
