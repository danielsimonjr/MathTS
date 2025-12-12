/**
 * Matrix Transpose Shaders
 *
 * WGSL compute shaders for matrix transpose operations:
 * - Naive transpose (simple, memory-bound)
 * - Tiled transpose (shared memory optimization for coalesced access)
 *
 * The tiled version uses shared memory to achieve coalesced reads AND writes,
 * which is critical for bandwidth-limited transpose operations.
 */

// Parameters
struct TransposeParams {
    rows: u32,     // Input rows (output cols)
    cols: u32,     // Input cols (output rows)
    padding1: u32,
    padding2: u32,
}

// Storage buffers
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: TransposeParams;

// Tile size for shared memory transpose
const TILE_SIZE: u32 = 32u;
const TILE_SIZE_PLUS_1: u32 = 33u;  // +1 to avoid bank conflicts

/**
 * Naive transpose
 *
 * Simple implementation where each thread transposes one element.
 * Memory access pattern is not optimal (strided writes).
 */
@compute @workgroup_size(16, 16)
fn transpose_naive(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.y;  // Input row
    let col = global_id.x;  // Input col

    if (row >= params.rows || col >= params.cols) {
        return;
    }

    // Read from input[row, col], write to output[col, row]
    let in_idx = row * params.cols + col;
    let out_idx = col * params.rows + row;

    output[out_idx] = input[in_idx];
}

/**
 * Tiled transpose with shared memory
 *
 * Uses shared memory to achieve coalesced memory access:
 * 1. Each workgroup loads a tile from input (coalesced reads)
 * 2. Synchronize
 * 3. Write transposed tile to output (coalesced writes)
 *
 * The shared memory tile has an extra column to avoid bank conflicts
 * during the transposed read.
 */

// Shared memory tile with padding to avoid bank conflicts
// Using TILE_SIZE = 32, add 1 padding column per row
var<workgroup> tile: array<f32, 1056>;  // 32 * 33 = 1056

@compute @workgroup_size(32, 32)
fn transpose_tiled(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let local_x = local_id.x;
    let local_y = local_id.y;

    // Calculate input position
    let in_row = workgroup_id.y * TILE_SIZE + local_y;
    let in_col = workgroup_id.x * TILE_SIZE + local_x;

    // Load from input to shared memory (coalesced read)
    if (in_row < params.rows && in_col < params.cols) {
        let in_idx = in_row * params.cols + in_col;
        // Store in [local_y, local_x] with padding
        tile[local_y * TILE_SIZE_PLUS_1 + local_x] = input[in_idx];
    } else {
        tile[local_y * TILE_SIZE_PLUS_1 + local_x] = 0.0;
    }

    workgroupBarrier();

    // Calculate output position (swapped workgroup indices)
    let out_row = workgroup_id.x * TILE_SIZE + local_y;
    let out_col = workgroup_id.y * TILE_SIZE + local_x;

    // Read transposed from shared memory (coalesced pattern)
    // Read from [local_x, local_y] (swapped)
    let value = tile[local_x * TILE_SIZE_PLUS_1 + local_y];

    // Write to output (coalesced write)
    if (out_row < params.cols && out_col < params.rows) {
        let out_idx = out_row * params.rows + out_col;
        output[out_idx] = value;
    }
}

/**
 * In-place transpose for square matrices
 *
 * Swaps elements across the diagonal.
 * Only works for square matrices (rows == cols).
 */
@compute @workgroup_size(16, 16)
fn transpose_inplace(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.y;
    let col = global_id.x;

    // Only process upper triangle (excluding diagonal)
    if (row >= params.rows || col >= params.cols || row >= col) {
        return;
    }

    // Swap [row, col] with [col, row]
    let idx1 = row * params.cols + col;
    let idx2 = col * params.rows + row;

    let temp = input[idx1];
    output[idx1] = input[idx2];
    output[idx2] = temp;
}

/**
 * Block transpose for batch processing
 *
 * Transposes multiple small matrices stored contiguously.
 * Useful for batch operations on many small matrices.
 *
 * params.padding1 = batch_size
 * params.padding2 = matrix_elements (rows * cols)
 */
@compute @workgroup_size(256)
fn transpose_batch(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let thread_idx = global_id.x;
    let batch_size = params.padding1;
    let matrix_elements = params.padding2;

    // Calculate which matrix and which element
    let total_elements = batch_size * matrix_elements;
    if (thread_idx >= total_elements) {
        return;
    }

    let matrix_idx = thread_idx / matrix_elements;
    let element_idx = thread_idx % matrix_elements;

    // Calculate row and column within this matrix
    let row = element_idx / params.cols;
    let col = element_idx % params.cols;

    // Calculate transposed index
    let transposed_element_idx = col * params.rows + row;

    // Calculate global indices
    let in_idx = matrix_idx * matrix_elements + element_idx;
    let out_idx = matrix_idx * matrix_elements + transposed_element_idx;

    output[out_idx] = input[in_idx];
}

/**
 * Hermitian conjugate transpose (for complex matrices)
 *
 * Transposes and conjugates a complex matrix.
 * Complex numbers are stored as pairs: [re, im, re, im, ...]
 *
 * Note: This shader expects the matrix to be stored with interleaved
 * real and imaginary parts.
 */
@compute @workgroup_size(16, 16)
fn transpose_hermitian(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.y;
    let col = global_id.x;

    if (row >= params.rows || col >= params.cols) {
        return;
    }

    // Each element is 2 floats (re, im)
    let in_idx = (row * params.cols + col) * 2u;
    let out_idx = (col * params.rows + row) * 2u;

    // Copy real part
    output[out_idx] = input[in_idx];
    // Conjugate imaginary part (negate)
    output[out_idx + 1u] = -input[in_idx + 1u];
}
