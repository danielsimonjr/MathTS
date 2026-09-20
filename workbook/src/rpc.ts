/**
 * Pure JSON-RPC 2.0 router for `mtsw serve`. `handleRequest(session, request)`
 * maps a request to a Session call and returns the response plus any streamed
 * `cell/event` notifications — no stdio, so the protocol logic is unit-testable.
 */

import type { Session } from './session.js';
import { capabilitiesInfo, listFunctions } from './introspect.js';
import { describeData } from './doc.js';
import type { CellType } from './types.js';
import type { CellPosition } from './edit.js';

/**
 * A JSON-RPC 2.0 request as received. All fields are optional because the input is not
 * yet validated. `handleRequest()` rejects a request with no string `method`.
 */
export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * A JSON-RPC 2.0 response. It contains `result` on success or `error` on failure.
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * A `cell/event` notification. `run` returns one for each executor event.
 */
export interface JsonRpcEvent {
  jsonrpc: '2.0';
  method: 'cell/event';
  params: { type: string; cellId?: string; error?: string };
}

/**
 * Output of `handleRequest()`: the response, the events to send before it, and a flag
 * that tells the server to stop.
 */
export interface HandleResult {
  response: JsonRpcResponse;
  events: JsonRpcEvent[];
  shutdown: boolean;
}

const CODE = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Route one JSON-RPC request to a `Session` method and build the response. The function
 * does no I/O on stdin or stdout.
 *
 * The function does not throw for errors in a request. A request with no string
 * `method` gives error -32600. An unknown method gives -32601. A missing `path` for
 * `open` gives -32602. An exception from a session method gives -32603 with the
 * exception message. The response `id` is `null` if the request has no `id`.
 *
 * @param session - The session that holds the open workbook.
 * @param request - The parsed request.
 * @returns The response, the events for a `run`, and `shutdown` set to true for the
 * `shutdown` method.
 */
export async function handleRequest(
  session: Session,
  request: JsonRpcRequest
): Promise<HandleResult> {
  const id = request && request.id !== undefined ? request.id : null;
  const ok = (result: unknown, events: JsonRpcEvent[] = [], shutdown = false): HandleResult => ({
    response: { jsonrpc: '2.0', id, result },
    events,
    shutdown,
  });
  const fail = (code: number, message: string): HandleResult => ({
    response: { jsonrpc: '2.0', id, error: { code, message } },
    events: [],
    shutdown: false,
  });

  if (!request || typeof request.method !== 'string') {
    return fail(CODE.INVALID_REQUEST, 'Invalid request: missing method');
  }
  const p = (request.params ?? {}) as Record<string, unknown>;
  const doc = () => describeData(session.workbook ?? undefined);

  try {
    switch (request.method) {
      case 'open': {
        const path = str(p.path);
        if (path === undefined) return fail(CODE.INVALID_PARAMS, 'open requires params.path');
        session.open(path, { force: p.force === true });
        return ok({ path: session.path, ...doc() });
      }
      case 'describe':
        return ok(doc());
      case 'validate': {
        const d = doc();
        const problems = d.graph.cycles.map((c) => `Dependency cycle: ${c.join(' -> ')}`);
        return ok({ ok: problems.length === 0, problems, cellCount: d.cells.length });
      }
      case 'graph':
        return ok(doc().graph);
      case 'run': {
        const { result, events } = await session.run(str(p.only));
        const evts: JsonRpcEvent[] = events.map((e) => ({
          jsonrpc: '2.0',
          method: 'cell/event',
          params: { type: e.type, cellId: e.cellId, error: e.error },
        }));
        return ok(result, evts);
      }
      case 'cell/add':
        session.addCell(
          {
            id: str(p.id) ?? '',
            type: (str(p.type) ?? '') as CellType,
            content: str(p.content),
            dependsOn: Array.isArray(p.dependsOn) ? (p.dependsOn as string[]) : undefined,
          },
          p.position as CellPosition | undefined
        );
        return ok(doc());
      case 'cell/edit':
        session.editCell(str(p.id) ?? '', {
          content: str(p.content),
          type: str(p.type) as CellType | undefined,
          dependsOn: Array.isArray(p.dependsOn) ? (p.dependsOn as string[]) : undefined,
        });
        return ok(doc());
      case 'cell/rm': {
        const changedCells = session.removeCell(str(p.id) ?? '', { force: p.force === true });
        return ok({ changedCells, ...doc() });
      }
      case 'cell/move':
        session.moveCell(str(p.id) ?? '', (p.position as CellPosition) ?? {});
        return ok(doc());
      case 'cell/rename':
        session.renameCell(str(p.oldId) ?? '', str(p.newId) ?? '');
        return ok(doc());
      case 'meta/get':
        return ok(session.workbook?.metadata ?? {});
      case 'meta/set':
        session.setMetadata({
          title: str(p.title),
          author: str(p.author),
          description: str(p.description),
          tags: Array.isArray(p.tags) ? (p.tags as string[]) : undefined,
        });
        return ok(session.workbook?.metadata ?? {});
      case 'save':
        return ok({ path: session.save(str(p.path)) });
      case 'capabilities':
        return ok(capabilitiesInfo());
      case 'functions':
        return ok(listFunctions());
      case 'shutdown':
        return ok({ ok: true }, [], true);
      default:
        return fail(CODE.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
    }
  } catch (error) {
    return fail(CODE.INTERNAL, error instanceof Error ? error.message : String(error));
  }
}

export { CODE as JSON_RPC_CODES };
