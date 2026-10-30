/**
 * Worker entry for parallel {@link evaluateScalarPopulation} (M14). Built as its own
 * tsdown entry next to `index.js` and loaded by URL; the package barrel never imports it.
 */

import { runScalarBatchTask, type ScalarBatchTask } from './scalar-batch-task.js';

interface WorkerMessage<T = unknown> {
  id: string;
  type: 'task' | 'result' | 'error';
  data?: T;
  error?: string;
}

const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

let nodeParentPort: { postMessage: (value: unknown) => void } | null = null;

function sendMessage(message: WorkerMessage): void {
  if (isNode) {
    nodeParentPort?.postMessage(message);
  } else {
    (postMessage as (msg: unknown) => void)(message);
  }
}

function handleMessage(message: WorkerMessage): void {
  try {
    const result = runScalarBatchTask(message.data as ScalarBatchTask);
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
    parentPort.on('message', handleMessage);
  });
} else {
  addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    handleMessage(event.data);
  });
}
