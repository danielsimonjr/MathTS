/**
 * Web worker entry for parallel {@link evaluateScalarPopulation} (M14).
 */

import { evaluateScalarTape } from './scalar-compile.js';

interface WorkerMessage<T = unknown> {
  id: string;
  type: 'task' | 'result' | 'error';
  data?: T;
  error?: string;
}

type TapePayload = Parameters<typeof evaluateScalarTape>[0];

interface PopulationItemPayload {
  readonly candidateIndex: number;
  readonly tape: TapePayload;
  readonly rootReg: number;
  readonly nRegs: number;
  readonly params: readonly number[];
  readonly parameters: readonly string[];
}

interface ScalarBatchWorkerPayload {
  readonly items: readonly PopulationItemPayload[];
  readonly columns: readonly Float64Array[];
  readonly variables: readonly string[];
}

interface ScalarBatchWorkerResultRow {
  readonly candidateIndex: number;
  readonly values: Float64Array;
  readonly valid: Uint8Array;
  readonly allValid: boolean;
}

interface ScalarBatchWorkerResult {
  readonly rows: readonly ScalarBatchWorkerResultRow[];
}

const MESSAGE_PREFIX = 'compileScalar:';

const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

let nodeParentPort: { postMessage: (value: unknown) => void } | null = null;

function sendMessage(message: WorkerMessage): void {
  if (isNode) {
    nodeParentPort?.postMessage(message);
  } else {
    (postMessage as (msg: unknown) => void)(message);
  }
}

function handleMessage(event: MessageEvent<WorkerMessage> | WorkerMessage): void {
  const message: WorkerMessage = isNode
    ? (event as WorkerMessage)
    : (event as MessageEvent<WorkerMessage>).data;

  try {
    const payload = message.data as ScalarBatchWorkerPayload;
    const rows: ScalarBatchWorkerResultRow[] = [];
    for (const item of payload.items) {
      const batch = evaluateScalarTape(
        item.tape,
        item.rootReg,
        item.nRegs,
        payload.columns,
        payload.variables,
        item.params,
        item.parameters,
        MESSAGE_PREFIX
      );
      rows.push({
        candidateIndex: item.candidateIndex,
        values: batch.values,
        valid: batch.valid,
        allValid: batch.allValid,
      });
    }
    const result: ScalarBatchWorkerResult = { rows };
    sendMessage({ id: message.id, type: 'result', data: result });
  } catch (error) {
    sendMessage({
      id: message.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

if (isNode) {
  void import('worker_threads').then(({ parentPort }) => {
    if (!parentPort) {
      throw new Error('scalar-batch.worker: missing parentPort');
    }
    nodeParentPort = parentPort;
    parentPort.on('message', (data: WorkerMessage) => {
      handleMessage(data);
    });
  });
} else {
  addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    handleMessage(event);
  });
}
