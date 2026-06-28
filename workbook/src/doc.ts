/**
 * The structured "describe" document model — shared by the `describe` CLI
 * command and the serve JSON-RPC router (kept out of cli.ts to avoid a cycle).
 */

import type { Workbook } from './types';
import { buildDependencyGraph, detectCycles } from './graph';

export interface DescribeDoc {
  version: string;
  metadata: Workbook['metadata'];
  runtime: Workbook['runtime'];
  cells: Array<{
    id: string;
    type: string;
    content: string;
    dependsOn: string[];
    metadata: Record<string, unknown>;
    output: unknown;
    error: unknown;
  }>;
  graph: { edges: Array<{ from: string; to: string }>; cycles: string[][] };
}

/** Build the `describe` payload for a (possibly missing) workbook. */
export function describeData(wb: Workbook | undefined): DescribeDoc {
  const cells = (wb?.cells ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    content: c.content,
    dependsOn: c.dependsOn ?? [],
    metadata: c.metadata ?? {},
    output: c.output ?? null,
    error: c.error ?? null,
  }));
  const graph = wb ? buildDependencyGraph(wb.cells) : undefined;
  const edges = graph
    ? [...graph.nodes].flatMap(([id, node]) => node.dependencies.map((dep) => ({ from: dep, to: id })))
    : [];
  const cycles = graph ? detectCycles(graph) : [];
  return {
    version: wb?.version ?? '1.0',
    metadata: wb?.metadata ?? {},
    runtime: wb?.runtime ?? { engine: 'mathts', execution: 'reactive' },
    cells,
    graph: { edges, cycles },
  };
}
