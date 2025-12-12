/**
 * LU Decomposition Shaders
 *
 * WGSL compute shaders for GPU-accelerated LU factorization.
 * Decomposes matrix A into L * U where:
 * - L is lower triangular with 1s on diagonal
 * - U is upper triangular
 *
 * Implementation uses blocked/tiled algorithm for better memory access patterns.
 * Note: This is a partial GPU implementation; some operations still need CPU coordination.
 */

// Parameters for LU decomposition
struct LUParams {
    n: u32,           // Matrix dimension (square matrix)
    blockSize: u32,   // Block size for tiled algorithm
    currentBlock: u32, // Current block being processed
    padding: u32,
}

// Storage buffers
// Matrix is stored in-place: lower triangle becomes L, upper triangle becomes U
@group(0) @binding(0) var<storage, read_write> matrix: array<f32>;
@group(0) @binding(1) var<storage, read_write> pivot: array<u32>;  // Pivot indices
@group(0) @binding(2) var<uniform> params: LUParams;

const BLOCK_SIZE: u32 = 32u;

/**
 * Find pivot (max element in column)
 *
 * Finds the row with maximum absolute value in the current column.
 * This is a parallel reduction to find argmax.
 *
 * Note: For numerical stability, partial pivoting is essential.
 */
var<workgroup> shared_vals: array<f32, 256>;
var<workgroup> shared_indices: array<u32, 256>;

@compute @workgroup_size(256)
fn find_pivot(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let thread_id = local_id.x;
    let col = params.currentBlock;  // Column we're finding pivot for
    let start_row = col;  // Start from diagonal

    // Each thread checks one row
    let row = start_row + global_id.x;

    // Load absolute value and index
    if (row < params.n) {
        let idx = row * params.n + col;
        shared_vals[thread_id] = abs(matrix[idx]);
        shared_indices[thread_id] = row;
    } else {
        shared_vals[thread_id] = 0.0;
        shared_indices[thread_id] = 0u;
    }

    workgroupBarrier();

    // Parallel reduction to find max
    for (var stride: u32 = 128u; stride > 0u; stride = stride / 2u) {
        if (thread_id < stride && thread_id + stride < 256u) {
            if (shared_vals[thread_id + stride] > shared_vals[thread_id]) {
                shared_vals[thread_id] = shared_vals[thread_id + stride];
                shared_indices[thread_id] = shared_indices[thread_id + stride];
            }
        }
        workgroupBarrier();
    }

    // First thread writes pivot index
    if (thread_id == 0u) {
        pivot[col] = shared_indices[0];
    }
}

/**
 * Swap rows for pivoting
 *
 * Swaps row i with row pivot[i] across the entire matrix.
 */
@compute @workgroup_size(256)
fn swap_rows(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let col = global_id.x;
    let row1 = params.currentBlock;
    let row2 = pivot[row1];

    if (col >= params.n || row1 == row2) {
        return;
    }

    let idx1 = row1 * params.n + col;
    let idx2 = row2 * params.n + col;

    let temp = matrix[idx1];
    matrix[idx1] = matrix[idx2];
    matrix[idx2] = temp;
}

/**
 * Scale column (compute L factors)
 *
 * Divides elements below diagonal by the pivot element.
 * L[i, k] = A[i, k] / A[k, k] for i > k
 */
@compute @workgroup_size(256)
fn scale_column(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = params.currentBlock + 1u + global_id.x;  // Start below diagonal
    let col = params.currentBlock;

    if (row >= params.n) {
        return;
    }

    let pivot_idx = col * params.n + col;  // Diagonal element
    let target_idx = row * params.n + col;

    let pivot_val = matrix[pivot_idx];

    // Avoid division by zero
    if (abs(pivot_val) > 1e-10) {
        matrix[target_idx] = matrix[target_idx] / pivot_val;
    }
}

/**
 * Update submatrix (Schur complement)
 *
 * Updates the submatrix below and to the right of current pivot:
 * A[i, j] -= L[i, k] * U[k, j] for i > k and j > k
 *
 * This is the main computation in LU decomposition.
 */
@compute @workgroup_size(16, 16)
fn update_submatrix(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let k = params.currentBlock;  // Current pivot column/row
    let i = k + 1u + global_id.y;  // Row (below pivot)
    let j = k + 1u + global_id.x;  // Column (right of pivot)

    if (i >= params.n || j >= params.n) {
        return;
    }

    // Get L[i, k] (below diagonal in column k)
    let l_ik = matrix[i * params.n + k];

    // Get U[k, j] (in row k, to the right)
    let u_kj = matrix[k * params.n + j];

    // Update A[i, j]
    let idx = i * params.n + j;
    matrix[idx] = matrix[idx] - l_ik * u_kj;
}

/**
 * Blocked panel factorization
 *
 * Factorizes a panel (block of columns) of the matrix.
 * Used in blocked LU for better cache utilization.
 */
var<workgroup> panel: array<f32, 1024>;  // 32 x 32 block

@compute @workgroup_size(32, 32)
fn factorize_panel(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let local_row = local_id.y;
    let local_col = local_id.x;
    let block_start = params.currentBlock * BLOCK_SIZE;

    // Load panel to shared memory
    let global_row = block_start + local_row;
    let global_col = block_start + local_col;

    if (global_row < params.n && global_col < params.n) {
        let idx = global_row * params.n + global_col;
        panel[local_row * BLOCK_SIZE + local_col] = matrix[idx];
    } else {
        panel[local_row * BLOCK_SIZE + local_col] = 0.0;
    }

    workgroupBarrier();

    // Factorize panel in shared memory
    for (var k: u32 = 0u; k < BLOCK_SIZE; k = k + 1u) {
        workgroupBarrier();

        // Scale column (compute L factors)
        if (local_col == k && local_row > k) {
            let pivot_val = panel[k * BLOCK_SIZE + k];
            if (abs(pivot_val) > 1e-10) {
                panel[local_row * BLOCK_SIZE + k] = panel[local_row * BLOCK_SIZE + k] / pivot_val;
            }
        }

        workgroupBarrier();

        // Update submatrix
        if (local_row > k && local_col > k) {
            let l_ik = panel[local_row * BLOCK_SIZE + k];
            let u_kj = panel[k * BLOCK_SIZE + local_col];
            panel[local_row * BLOCK_SIZE + local_col] -= l_ik * u_kj;
        }
    }

    workgroupBarrier();

    // Write back to global memory
    if (global_row < params.n && global_col < params.n) {
        let idx = global_row * params.n + global_col;
        matrix[idx] = panel[local_row * BLOCK_SIZE + local_col];
    }
}

/**
 * Forward substitution (solve L * y = b)
 *
 * Solves the lower triangular system.
 * Used after LU factorization to solve linear systems.
 */
@compute @workgroup_size(1)
fn forward_substitution() {
    // Sequential algorithm - each row depends on previous rows
    // This shader is mainly for small systems or as a template
    // For large systems, use triangular solve with multiple threads

    for (var i: u32 = 0u; i < params.n; i = i + 1u) {
        // y[i] = b[i] - sum(L[i,j] * y[j] for j < i)
        // In LU format, L has 1s on diagonal (implicit)
        var sum: f32 = 0.0;
        for (var j: u32 = 0u; j < i; j = j + 1u) {
            let l_ij = matrix[i * params.n + j];
            sum = sum + l_ij * pivot[j];  // Using pivot as y vector
        }
        // Note: In actual implementation, b and y would be separate buffers
    }
}

/**
 * Backward substitution (solve U * x = y)
 *
 * Solves the upper triangular system.
 */
@compute @workgroup_size(1)
fn backward_substitution() {
    // Sequential algorithm - process from bottom to top
    for (var i_plus_1: u32 = params.n; i_plus_1 > 0u; i_plus_1 = i_plus_1 - 1u) {
        let i = i_plus_1 - 1u;

        var sum: f32 = 0.0;
        for (var j: u32 = i + 1u; j < params.n; j = j + 1u) {
            let u_ij = matrix[i * params.n + j];
            sum = sum + u_ij * pivot[j];  // Using pivot as x vector
        }

        let u_ii = matrix[i * params.n + i];
        if (abs(u_ii) > 1e-10) {
            // x[i] = (y[i] - sum) / U[i,i]
            // Note: actual implementation needs separate buffers
        }
    }
}

/**
 * Extract L matrix from LU-combined storage
 *
 * Creates explicit L matrix (lower triangular with 1s on diagonal).
 */
@compute @workgroup_size(16, 16)
fn extract_L(
    @builtin(global_invocation_id) global_id: vec3<u32>
) {
    let row = global_id.y;
    let col = global_id.x;

    if (row >= params.n || col >= params.n) {
        return;
    }

    let idx = row * params.n + col;

    if (col < row) {
        // Below diagonal: copy from combined matrix
        // L is already stored there
    } else if (col == row) {
        // Diagonal: L has 1s
        matrix[idx] = 1.0;
    } else {
        // Above diagonal: L has 0s
        matrix[idx] = 0.0;
    }
}

/**
 * Extract U matrix from LU-combined storage
 *
 * Creates explicit U matrix (upper triangular).
 */
@compute @workgroup_size(16, 16)
fn extract_U(
    @builtin(global_invocation_id) global_id: vec3<u32>
) {
    let row = global_id.y;
    let col = global_id.x;

    if (row >= params.n || col >= params.n) {
        return;
    }

    let idx = row * params.n + col;

    if (col >= row) {
        // On or above diagonal: copy from combined matrix
        // U is already stored there
    } else {
        // Below diagonal: U has 0s
        matrix[idx] = 0.0;
    }
}
