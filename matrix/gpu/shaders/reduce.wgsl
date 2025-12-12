/**
 * Parallel Reduction Shaders
 *
 * WGSL compute shaders for parallel reduction operations:
 * - Sum (total of all elements)
 * - Max (maximum element)
 * - Min (minimum element)
 * - Mean (average)
 * - Variance (population variance)
 * - Norm (L2 norm / Euclidean norm)
 *
 * Uses tree-based parallel reduction pattern for O(log n) time complexity.
 */

// Parameters
struct ReduceParams {
    count: u32,     // Number of elements to reduce
    padding1: u32,
    padding2: u32,
    padding3: u32,
}

// Storage buffers
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: ReduceParams;

// Workgroup size and shared memory
const WORKGROUP_SIZE: u32 = 256u;
var<workgroup> shared_data: array<f32, 256>;

/**
 * Sum reduction
 *
 * Computes the sum of all elements using parallel reduction.
 * Multiple workgroups produce partial sums that need to be summed.
 */
@compute @workgroup_size(256)
fn reduce_sum(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load from global memory (with bounds check)
    if (global_idx < params.count) {
        shared_data[local_idx] = input[global_idx];
    } else {
        shared_data[local_idx] = 0.0;
    }
    workgroupBarrier();

    // Tree-based reduction
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = shared_data[local_idx] + shared_data[local_idx + stride];
        }
        workgroupBarrier();
    }

    // First thread writes result for this workgroup
    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}

/**
 * Max reduction
 *
 * Finds the maximum element using parallel reduction.
 */
@compute @workgroup_size(256)
fn reduce_max(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load from global memory (use -infinity for out-of-bounds)
    if (global_idx < params.count) {
        shared_data[local_idx] = input[global_idx];
    } else {
        // Use a very small number as sentinel
        shared_data[local_idx] = -3.402823466e+38;  // -FLT_MAX
    }
    workgroupBarrier();

    // Tree-based reduction with max
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = max(shared_data[local_idx], shared_data[local_idx + stride]);
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}

/**
 * Min reduction
 *
 * Finds the minimum element using parallel reduction.
 */
@compute @workgroup_size(256)
fn reduce_min(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load from global memory (use +infinity for out-of-bounds)
    if (global_idx < params.count) {
        shared_data[local_idx] = input[global_idx];
    } else {
        // Use a very large number as sentinel
        shared_data[local_idx] = 3.402823466e+38;  // FLT_MAX
    }
    workgroupBarrier();

    // Tree-based reduction with min
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = min(shared_data[local_idx], shared_data[local_idx + stride]);
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}

/**
 * Sum of squares reduction (for L2 norm and variance)
 *
 * Computes sum(x^2) using parallel reduction.
 */
@compute @workgroup_size(256)
fn reduce_sum_sq(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load and square
    if (global_idx < params.count) {
        let val = input[global_idx];
        shared_data[local_idx] = val * val;
    } else {
        shared_data[local_idx] = 0.0;
    }
    workgroupBarrier();

    // Tree-based reduction
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = shared_data[local_idx] + shared_data[local_idx + stride];
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}

/**
 * Argmax reduction
 *
 * Finds index of maximum element.
 * Stores both value and index in adjacent locations.
 */
var<workgroup> shared_vals: array<f32, 256>;
var<workgroup> shared_indices: array<u32, 256>;

@compute @workgroup_size(256)
fn reduce_argmax(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load values and indices
    if (global_idx < params.count) {
        shared_vals[local_idx] = input[global_idx];
        shared_indices[local_idx] = global_idx;
    } else {
        shared_vals[local_idx] = -3.402823466e+38;
        shared_indices[local_idx] = 0u;
    }
    workgroupBarrier();

    // Tree reduction keeping track of index
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            let right_val = shared_vals[local_idx + stride];
            if (right_val > shared_vals[local_idx]) {
                shared_vals[local_idx] = right_val;
                shared_indices[local_idx] = shared_indices[local_idx + stride];
            }
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        // Store value and index for this workgroup
        output[workgroup_id.x * 2u] = shared_vals[0];
        output[workgroup_id.x * 2u + 1u] = f32(shared_indices[0]);
    }
}

/**
 * Argmin reduction
 *
 * Finds index of minimum element.
 */
@compute @workgroup_size(256)
fn reduce_argmin(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load values and indices
    if (global_idx < params.count) {
        shared_vals[local_idx] = input[global_idx];
        shared_indices[local_idx] = global_idx;
    } else {
        shared_vals[local_idx] = 3.402823466e+38;
        shared_indices[local_idx] = 0u;
    }
    workgroupBarrier();

    // Tree reduction keeping track of index
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            let right_val = shared_vals[local_idx + stride];
            if (right_val < shared_vals[local_idx]) {
                shared_vals[local_idx] = right_val;
                shared_indices[local_idx] = shared_indices[local_idx + stride];
            }
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x * 2u] = shared_vals[0];
        output[workgroup_id.x * 2u + 1u] = f32(shared_indices[0]);
    }
}

/**
 * Product reduction
 *
 * Computes product of all elements (useful for determinants).
 */
@compute @workgroup_size(256)
fn reduce_product(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;

    // Load from global memory (use 1.0 for out-of-bounds)
    if (global_idx < params.count) {
        shared_data[local_idx] = input[global_idx];
    } else {
        shared_data[local_idx] = 1.0;
    }
    workgroupBarrier();

    // Tree-based reduction with multiplication
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = shared_data[local_idx] * shared_data[local_idx + stride];
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}

/**
 * Count non-zero elements
 *
 * Counts elements that are not zero (or near zero).
 */
@compute @workgroup_size(256)
fn reduce_count_nonzero(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;
    let epsilon = 1e-10;

    // Count as 1 if non-zero, 0 otherwise
    if (global_idx < params.count) {
        if (abs(input[global_idx]) > epsilon) {
            shared_data[local_idx] = 1.0;
        } else {
            shared_data[local_idx] = 0.0;
        }
    } else {
        shared_data[local_idx] = 0.0;
    }
    workgroupBarrier();

    // Sum reduction for count
    for (var stride: u32 = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            shared_data[local_idx] = shared_data[local_idx] + shared_data[local_idx + stride];
        }
        workgroupBarrier();
    }

    if (local_idx == 0u) {
        output[workgroup_id.x] = shared_data[0];
    }
}
