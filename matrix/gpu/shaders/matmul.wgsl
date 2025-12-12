/**
 * Matrix Multiplication Shaders
 *
 * WGSL compute shaders for matrix multiplication:
 * - Naive implementation (simple but slower)
 * - Tiled implementation (cache-efficient for large matrices)
 *
 * Matrix storage: Row-major (C convention)
 * A: M x K matrix
 * B: K x N matrix
 * C: M x N matrix (result)
 * C[i,j] = sum(A[i,k] * B[k,j] for k in 0..K)
 */

// Parameters for matmul: M, N, K dimensions
struct MatmulParams {
    M: u32,  // Rows of A and C
    N: u32,  // Cols of B and C
    K: u32,  // Cols of A / Rows of B
    padding: u32,
}

// Storage buffers
@group(0) @binding(0) var<storage, read> matrixA: array<f32>;
@group(0) @binding(1) var<storage, read> matrixB: array<f32>;
@group(0) @binding(2) var<storage, read_write> matrixC: array<f32>;
@group(0) @binding(3) var<uniform> params: MatmulParams;

// Tile size for tiled matmul (must match workgroup size)
const TILE_SIZE: u32 = 16u;

/**
 * Naive matrix multiplication
 *
 * Each thread computes one element of the result matrix.
 * Simple but memory-bound for large matrices.
 *
 * Workgroup size: 16x16 = 256 threads
 */
@compute @workgroup_size(16, 16)
fn matmul_naive(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.y;
    let col = global_id.x;

    if (row >= params.M || col >= params.N) {
        return;
    }

    var sum: f32 = 0.0;
    for (var k: u32 = 0u; k < params.K; k = k + 1u) {
        let a_idx = row * params.K + k;
        let b_idx = k * params.N + col;
        sum = sum + matrixA[a_idx] * matrixB[b_idx];
    }

    let c_idx = row * params.N + col;
    matrixC[c_idx] = sum;
}

/**
 * Tiled (blocked) matrix multiplication
 *
 * Uses shared memory tiles to reduce global memory bandwidth.
 * Each workgroup loads tiles of A and B into shared memory,
 * computes partial products, then accumulates results.
 *
 * This achieves much better cache utilization for large matrices.
 *
 * Workgroup size: TILE_SIZE x TILE_SIZE = 256 threads
 */

// Shared memory for tiles
var<workgroup> tile_A: array<f32, 256>;  // TILE_SIZE * TILE_SIZE
var<workgroup> tile_B: array<f32, 256>;

@compute @workgroup_size(16, 16)
fn matmul_tiled(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let row = global_id.y;
    let col = global_id.x;
    let local_row = local_id.y;
    let local_col = local_id.x;

    // Number of tiles needed to cover K dimension
    let num_tiles = (params.K + TILE_SIZE - 1u) / TILE_SIZE;

    var sum: f32 = 0.0;

    // Iterate through tiles
    for (var t: u32 = 0u; t < num_tiles; t = t + 1u) {
        // Load tile from matrix A
        let a_row = row;
        let a_col = t * TILE_SIZE + local_col;
        if (a_row < params.M && a_col < params.K) {
            tile_A[local_row * TILE_SIZE + local_col] = matrixA[a_row * params.K + a_col];
        } else {
            tile_A[local_row * TILE_SIZE + local_col] = 0.0;
        }

        // Load tile from matrix B
        let b_row = t * TILE_SIZE + local_row;
        let b_col = col;
        if (b_row < params.K && b_col < params.N) {
            tile_B[local_row * TILE_SIZE + local_col] = matrixB[b_row * params.N + b_col];
        } else {
            tile_B[local_row * TILE_SIZE + local_col] = 0.0;
        }

        // Synchronize to ensure tile is loaded
        workgroupBarrier();

        // Compute partial dot product for this tile
        for (var k: u32 = 0u; k < TILE_SIZE; k = k + 1u) {
            sum = sum + tile_A[local_row * TILE_SIZE + k] * tile_B[k * TILE_SIZE + local_col];
        }

        // Synchronize before loading next tile
        workgroupBarrier();
    }

    // Write result
    if (row < params.M && col < params.N) {
        matrixC[row * params.N + col] = sum;
    }
}

/**
 * Matrix transpose
 *
 * Transposes a matrix in-place or to a separate buffer.
 * Input: M x N matrix
 * Output: N x M matrix
 */
@compute @workgroup_size(16, 16)
fn matrix_transpose(
    @builtin(global_invocation_id) global_id: vec3<u32>
) {
    let row = global_id.y;  // Output row (input col)
    let col = global_id.x;  // Output col (input row)

    // Swap dimensions: N becomes rows, M becomes cols
    if (row >= params.N || col >= params.M) {
        return;
    }

    // Read from input (M x N) and write to output (N x M)
    // input[col, row] -> output[row, col]
    let in_idx = col * params.N + row;  // Note: using K as N here
    let out_idx = row * params.M + col;  // Output: N rows, M cols

    matrixC[out_idx] = matrixA[in_idx];
}

/**
 * Matrix-vector multiplication
 *
 * y = A * x where A is M x N and x is N x 1
 * Result y is M x 1
 */
@compute @workgroup_size(256)
fn matvec(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.x;

    if (row >= params.M) {
        return;
    }

    var sum: f32 = 0.0;
    for (var j: u32 = 0u; j < params.N; j = j + 1u) {
        sum = sum + matrixA[row * params.N + j] * matrixB[j];
    }

    matrixC[row] = sum;
}

/**
 * Outer product
 *
 * C = a * b^T where a is M x 1 and b is N x 1
 * Result C is M x N
 */
@compute @workgroup_size(16, 16)
fn outer_product(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.y;
    let col = global_id.x;

    if (row >= params.M || col >= params.N) {
        return;
    }

    let c_idx = row * params.N + col;
    matrixC[c_idx] = matrixA[row] * matrixB[col];
}

/**
 * Dot product (for vectors)
 *
 * Uses parallel reduction pattern.
 * Each thread computes partial sum, then reduces within workgroup.
 */
var<workgroup> partial_sums: array<f32, 256>;

@compute @workgroup_size(256)
fn dot_product(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let global_idx = global_id.x;
    let local_idx = local_id.x;
    let total = params.M;  // Vector length stored in M

    // Each thread computes element-wise product
    var my_sum: f32 = 0.0;
    if (global_idx < total) {
        my_sum = matrixA[global_idx] * matrixB[global_idx];
    }

    partial_sums[local_idx] = my_sum;
    workgroupBarrier();

    // Parallel reduction within workgroup
    for (var stride: u32 = 128u; stride > 0u; stride = stride / 2u) {
        if (local_idx < stride) {
            partial_sums[local_idx] = partial_sums[local_idx] + partial_sums[local_idx + stride];
        }
        workgroupBarrier();
    }

    // First thread writes workgroup result
    if (local_idx == 0u) {
        matrixC[workgroup_id.x] = partial_sums[0];
    }
}
