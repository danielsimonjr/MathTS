/**
 * Matrix Worker for parallel computation
 * Handles matrix operations in a separate thread.
 *
 * Each task computes a contiguous slice of the output and returns it. The
 * parent ({@link ParallelMatrix}) copies returned slices back into the result
 * buffer. Returning the data (rather than relying on in-place mutation of a
 * shared buffer) keeps the worker correct whether or not the caller is using
 * SharedArrayBuffer — a structured-clone copy of a non-shared `resultData`
 * would otherwise be discarded and the caller would observe all zeros.
 */

interface WorkerMessage {
  id: string;
  type: 'task' | 'result' | 'error';
  data?: unknown;
  error?: string;
}

/** Numeric payload arrays survive structured clone as either form. */
type NumericArray = Float64Array | number[];

interface MultiplyPayload {
  aData: NumericArray;
  aCols: number;
  bData: NumericArray;
  bCols: number;
  startRow: number;
  endRow: number;
}

interface ElementwisePayload {
  aData: NumericArray;
  bData: NumericArray;
  start: number;
  end: number;
}

interface ScalePayload {
  aData: NumericArray;
  scalar: number;
  start: number;
  end: number;
}

interface TransposePayload {
  data: NumericArray;
  cols: number;
  startRow: number;
  endRow: number;
}

interface DotPayload {
  aData: NumericArray;
  bData: NumericArray;
  start: number;
  end: number;
}

interface SumPayload {
  aData: NumericArray;
  start: number;
  end: number;
}

type MatrixTask =
  | ({ operation: 'multiply' } & MultiplyPayload)
  | ({ operation: 'add' | 'subtract' | 'elementMultiply' } & ElementwisePayload)
  | ({ operation: 'scale' } & ScalePayload)
  | ({ operation: 'transpose' } & TransposePayload)
  | ({ operation: 'dot' } & DotPayload)
  | ({ operation: 'sum' } & SumPayload);

// Handle both Node.js worker_threads and browser Web Workers
const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

// In Node worker threads `postMessage` is not a global — replies must go
// through `parentPort`. Resolved asynchronously below; messages are queued
// until it is ready.
let nodeParentPort: { postMessage: (value: unknown) => void } | null = null;

/**
 * Post a message back to the spawning thread, using the correct channel for
 * the current environment.
 */
function sendMessage(message: WorkerMessage): void {
  if (isNode) {
    if (nodeParentPort) {
      nodeParentPort.postMessage(message);
    }
  } else {
    (postMessage as (msg: unknown) => void)(message);
  }
}

// Message handler
function handleMessage(event: MessageEvent<WorkerMessage> | WorkerMessage): void {
  const message: WorkerMessage = isNode
    ? (event as WorkerMessage)
    : (event as MessageEvent<WorkerMessage>).data;

  try {
    const task = message.data as MatrixTask;
    let result: Float64Array | number;

    switch (task.operation) {
      case 'multiply':
        result = multiplyTask(task);
        break;
      case 'add':
        result = elementwiseTask(task, (a, b) => a + b);
        break;
      case 'subtract':
        result = elementwiseTask(task, (a, b) => a - b);
        break;
      case 'elementMultiply':
        result = elementwiseTask(task, (a, b) => a * b);
        break;
      case 'scale':
        result = scaleTask(task);
        break;
      case 'transpose':
        result = transposeTask(task);
        break;
      case 'dot':
        result = dotProductTask(task);
        break;
      case 'sum':
        result = sumTask(task);
        break;
      default:
        // `task` is `never` here once all variants are handled; cast back to
        // read the (unexpected) operation for the diagnostic message.
        throw new Error(`Unknown operation: ${(task as MatrixTask).operation}`);
    }

    sendMessage({
      id: message.id,
      type: 'result',
      data: result,
    });
  } catch (error) {
    sendMessage({
      id: message.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Matrix multiplication task: computes rows [startRow, endRow) of C = A * B.
 * Returns the computed row block as a flat Float64Array.
 */
function multiplyTask(task: MultiplyPayload): Float64Array {
  const { aData, aCols, bData, bCols, startRow, endRow } = task;
  const rowCount = endRow - startRow;
  const out = new Float64Array(rowCount * bCols);

  for (let i = startRow; i < endRow; i++) {
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += aData[i * aCols + k] * bData[k * bCols + j];
      }
      out[(i - startRow) * bCols + j] = sum;
    }
  }

  return out;
}

/**
 * Element-wise binary task: computes op(A[i], B[i]) for i in [start, end).
 * Returns the computed slice as a flat Float64Array.
 */
function elementwiseTask(task: ElementwisePayload, op: (a: number, b: number) => number): Float64Array {
  const { aData, bData, start, end } = task;
  const out = new Float64Array(end - start);

  for (let i = start; i < end; i++) {
    out[i - start] = op(aData[i], bData[i]);
  }

  return out;
}

/**
 * Scalar multiplication task: computes A[i] * scalar for i in [start, end).
 * Returns the computed slice as a flat Float64Array.
 */
function scaleTask(task: ScalePayload): Float64Array {
  const { aData, scalar, start, end } = task;
  const out = new Float64Array(end - start);

  for (let i = start; i < end; i++) {
    out[i - start] = aData[i] * scalar;
  }

  return out;
}

/**
 * Matrix transpose task: transposes rows [startRow, endRow) of A.
 * Returns the transposed block in column-major order relative to the slice
 * (`out[j * rowCount + (i - startRow)] = A[i * cols + j]`); the parent
 * scatters it into the final result.
 */
function transposeTask(task: TransposePayload): Float64Array {
  const { data, cols, startRow, endRow } = task;
  const rowCount = endRow - startRow;
  const out = new Float64Array(rowCount * cols);

  for (let i = startRow; i < endRow; i++) {
    for (let j = 0; j < cols; j++) {
      out[j * rowCount + (i - startRow)] = data[i * cols + j];
    }
  }

  return out;
}

/**
 * Dot product task: sum(A[start:end] * B[start:end]).
 */
function dotProductTask(task: DotPayload): number {
  const { aData, bData, start, end } = task;

  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += aData[i] * bData[i];
  }

  return sum;
}

/**
 * Sum task: sum(A[start:end]).
 */
function sumTask(task: SumPayload): number {
  const { aData, start, end } = task;

  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += aData[i];
  }

  return sum;
}

// Set up message listener based on environment.
//
// Use a dynamic ESM `import()` (not `require`) for `node:worker_threads`:
// this file is emitted as an ESM module, and a CommonJS-style `require` would
// be rewritten by the bundler into a shim that throws
// "Dynamic require of \"worker_threads\" is not supported" at runtime.
if (isNode) {
  // Node.js worker_threads
  void import('node:worker_threads').then(({ parentPort }) => {
    if (parentPort) {
      nodeParentPort = parentPort;
      parentPort.on('message', handleMessage);
    }
  });
} else {
  // Browser Web Worker
  self.onmessage = handleMessage;
}

export {}; // Make this a module
