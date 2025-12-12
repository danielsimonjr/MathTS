/**
 * Element-wise Matrix Operations
 *
 * WGSL compute shaders for element-wise matrix operations:
 * - Addition
 * - Subtraction
 * - Multiplication (Hadamard product)
 * - Division
 * - Scalar operations
 */

// Uniform parameters for matrix dimensions
struct Params {
    rows: u32,
    cols: u32,
    padding1: u32,
    padding2: u32,
}

// Storage buffers for matrices
@group(0) @binding(0) var<storage, read> matrixA: array<f32>;
@group(0) @binding(1) var<storage, read> matrixB: array<f32>;
@group(0) @binding(2) var<storage, read_write> result: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

// Workgroup size for element-wise operations
const WORKGROUP_SIZE: u32 = 256u;

/**
 * Element-wise addition: result[i] = A[i] + B[i]
 */
@compute @workgroup_size(256)
fn matrix_add(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = matrixA[index] + matrixB[index];
    }
}

/**
 * Element-wise subtraction: result[i] = A[i] - B[i]
 */
@compute @workgroup_size(256)
fn matrix_sub(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = matrixA[index] - matrixB[index];
    }
}

/**
 * Element-wise multiplication (Hadamard product): result[i] = A[i] * B[i]
 */
@compute @workgroup_size(256)
fn matrix_mul_elementwise(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = matrixA[index] * matrixB[index];
    }
}

/**
 * Element-wise division: result[i] = A[i] / B[i]
 */
@compute @workgroup_size(256)
fn matrix_div(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = matrixA[index] / matrixB[index];
    }
}

// For scalar operations, we reuse matrixA buffer and use matrixB[0] as scalar

/**
 * Scalar multiplication: result[i] = A[i] * scalar
 * Uses matrixB[0] as the scalar value
 */
@compute @workgroup_size(256)
fn scalar_mul(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;
    let scalar = matrixB[0];  // Scalar stored in first element of B

    if (index < total) {
        result[index] = matrixA[index] * scalar;
    }
}

/**
 * Scalar addition: result[i] = A[i] + scalar
 */
@compute @workgroup_size(256)
fn scalar_add(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;
    let scalar = matrixB[0];

    if (index < total) {
        result[index] = matrixA[index] + scalar;
    }
}

/**
 * Absolute value: result[i] = |A[i]|
 */
@compute @workgroup_size(256)
fn matrix_abs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = abs(matrixA[index]);
    }
}

/**
 * Square: result[i] = A[i]^2
 */
@compute @workgroup_size(256)
fn matrix_square(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        let val = matrixA[index];
        result[index] = val * val;
    }
}

/**
 * Square root: result[i] = sqrt(A[i])
 */
@compute @workgroup_size(256)
fn matrix_sqrt(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = sqrt(matrixA[index]);
    }
}

/**
 * Exponential: result[i] = exp(A[i])
 */
@compute @workgroup_size(256)
fn matrix_exp(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = exp(matrixA[index]);
    }
}

/**
 * Natural log: result[i] = log(A[i])
 */
@compute @workgroup_size(256)
fn matrix_log(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total = params.rows * params.cols;

    if (index < total) {
        result[index] = log(matrixA[index]);
    }
}
