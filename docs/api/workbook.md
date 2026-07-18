# @danielsimonjr/mathts-workbook API Reference

Headless runtime + CLI for `.mtsw` reactive YAML notebooks. Code and test cells
are evaluated as **MathTS expressions** (via `@danielsimonjr/mathts-expression`'s
standalone compile/evaluate path) — **not** TypeScript or JavaScript.

## Installation

```bash
npm install @danielsimonjr/mathts-workbook
```

## Overview

A `.mtsw` file is YAML describing an ordered list of cells with a reactive
dependency graph. The runtime parses, topologically sorts, and evaluates cells;
`test` cells are boolean assertions. Because cell content runs through the
expression-package sandbox (property/method access routed through the safe
helpers), `executeCode` does **not** carry the arbitrary-code-execution exposure
of the `Function` constructor.

```typescript
import { parseWorkbook, WorkbookExecutor, createExecutor } from '@danielsimonjr/mathts-workbook';
```

## Core Types

| Type               | Definition                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CellType`         | `'markdown' \| 'code' \| 'tensor' \| 'equation' \| 'visualization' \| 'data' \| 'test' \| 'export'`                                    |
| `ExecutionMode`    | `'reactive' \| 'sequential' \| 'manual'`                                                                                               |
| `RuntimeConfig`    | `{ engine: 'mathts' \| 'custom', execution: ExecutionMode, timeout? }`                                                                 |
| `Cell`             | `{ id, type: CellType, content: string, dependsOn?: string[], output?, error?, metadata? }`                                            |
| `Workbook`         | `{ version: string, metadata: WorkbookMetadata, runtime: RuntimeConfig, cells: Cell[] }`                                               |
| `WorkbookMetadata` | `{ title?, author?, description?, tags?, created?, modified? }`                                                                        |
| `ParseResult`      | `{ success: boolean, workbook?: Workbook, errors?: string[], warnings?: string[] }`                                                    |
| `WorkbookEvent`    | `{ type: 'cell:start' \| 'cell:success' \| 'cell:error' \| 'cell:stale' \| 'workbook:complete', cellId?, output?, error?, timestamp }` |
| `CellResult`       | `{ id, type, status: 'success' \| 'error' \| 'pass' \| 'fail', output?, error? }`                                                      |
| `RunResult`        | `{ cells: CellResult[], ok: boolean }`                                                                                                 |
| `DependencyNode`   | `{ id, dependencies: string[], dependents: string[] }`                                                                                 |
| `DependencyGraph`  | `{ nodes: Map<string, DependencyNode>, executionOrder: string[] }`                                                                     |

## Parser

Hardened via `yaml-safe.ts` (core-schema-only parse, YAML merges disabled,
prototype-pollution guard) — the single YAML entry point shared by the document
parser and `data`-cell evaluation.

| Function            | Signature                                     | Description                                                   |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `detectCellType`    | `(cell: Record<string, unknown>) => CellType` | Infer type from YAML keys (first-match precedence)            |
| `parseWorkbook`     | `(content: string) => ParseResult`            | YAML → `Workbook`; validates ids/types/deps                   |
| `serializeWorkbook` | `(workbook: Workbook) => string`              | Round-trips through `parseWorkbook` (structural fields exact) |
| `stripOutputs`      | `(workbook: Workbook) => Workbook`            | Remove all `output` fields (git-friendly diffs)               |

## Dependency Graph

| Function               | Signature                                          | Description                                       |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `buildDependencyGraph` | `(cells: Cell[]) => DependencyGraph`               | Build the reactive graph                          |
| `topologicalSort`      | `(nodes: Map<string, DependencyNode>) => string[]` | Execution order                                   |
| `getDependents`        | `(graph, cellId) => string[]`                      | Direct dependents                                 |
| `getAncestors`         | `(graph, id) => string[]`                          | Transitive dependency closure + `id` (cycle-safe) |
| `toMermaid`            | `(graph) => string`                                | Render `graph TD` (ids validated, no injection)   |
| `detectCycles`         | `(graph) => string[][]`                            | Cycle detection                                   |

## Executor

### WorkbookExecutor

```typescript
new WorkbookExecutor(workbook: Workbook)
```

| Method        | Signature                                                         | Description                                                                                                                 |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `on`          | `(handler: EventHandler) => () => void`                           | Subscribe to the event stream; returns unsubscribe                                                                          |
| `runAll`      | `() => Promise<void>`                                             | Event-stream API — **throws on the first cell error**                                                                       |
| `runCell`     | `(cellId: string) => Promise<unknown>`                            | Run a single cell                                                                                                           |
| `seedOutputs` | `(entries: Map<string, unknown>) => void`                         | Seed the output cache (incremental/session runs)                                                                            |
| `runReport`   | `(options?: {only?, runIds?: Set<string>}) => Promise<RunResult>` | Headless/report API — **continue-on-error**, never throws on a cell failure; refuses on cycle; `test` cells → `pass`/`fail` |
| `getOutput`   | `(cellId: string) => unknown`                                     | Read a cell's cached output                                                                                                 |

`createExecutor(workbook: Workbook): WorkbookExecutor` is a convenience
constructor.

> `runAll()` (throw-on-first-error) and `runReport()` (continue-on-error,
> structured) are deliberately different contracts for interactive/reactive vs.
> CLI/report/CI consumers.

## Formatter

`formatResult(value: unknown): string` — crash-proof rendering for terminal
output. Called inside the continue-on-error loop, so it never throws (circular
refs, BigInt, unserializable values fall back to safe markers).

## Pure Cell-Mutation Ops

Immutable — every op returns a NEW `Workbook`, enforcing runnable-valid
invariants (unique/identifier-safe ids, supported types, existing `dependsOn`
refs, no self-dependency, no cycle) and throwing on violation.

| Function      | Signature                                                                           |
| ------------- | ----------------------------------------------------------------------------------- |
| `addCell`     | `(wb, spec: {id, type, content?, dependsOn?}, position?: CellPosition) => Workbook` |
| `editCell`    | `(wb, id, changes: {content?, type?, dependsOn?}) => Workbook`                      |
| `removeCell`  | `(wb, id, options?: {force?}) => RemoveResult`                                      |
| `moveCell`    | `(wb, id, position: CellPosition) => Workbook`                                      |
| `renameCell`  | `(wb, oldId, newId) => Workbook`                                                    |
| `setMetadata` | `(wb, changes: {title?, author?, description?, tags?}) => Workbook`                 |

`CellPosition = {before?: string, after?: string, at?: number}`;
`RemoveResult = {workbook, changedCells: string[]}`.

## Session

In-memory editing/execution session — the stateful core behind `mtsw serve`.
File I/O is limited to `open` / `save`; everything else is in-memory.

```typescript
class Session // fields: workbook: Workbook | null, path: string | null, dirty: boolean
```

| Method                    | Signature                                                                      | Description                                     |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| `open`                    | `(path, options?: {force?}) => void`                                           | Refuses to discard unsaved edits unless `force` |
| `addCell` … `setMetadata` | (same signatures as the pure ops)                                              | Applied in place with stale-set recomputation   |
| `run`                     | `(only?: string) => Promise<{result: RunResult, events: WorkbookEventLite[]}>` | Incremental — runs only stale cells + ancestors |
| `staleIds`                | `() => string[]`                                                               | Current stale-cell ids                          |
| `save`                    | `(path?: string) => string`                                                    | Serialize + write atomically                    |

`WorkbookEventLite = {type: string, cellId?: string, error?: string}`.

## JSON-RPC Router

Pure and unit-testable (no stdio).

| Export            | Definition                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `JsonRpcRequest`  | `{jsonrpc?, id?: string \| number \| null, method?, params?}`                                                          |
| `JsonRpcResponse` | `{jsonrpc: '2.0', id, result?, error?: {code, message}}`                                                               |
| `JsonRpcEvent`    | `{jsonrpc: '2.0', method: 'cell/event', params: {type, cellId?, error?}}`                                              |
| `handleRequest`   | `(session: Session, request: JsonRpcRequest) => Promise<HandleResult>` — `HandleResult = {response, events, shutdown}` |

## Timeout-Bounded Worker Run

| Export                   | Signature                                                                | Description                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `WorkbookTimeoutError`   | `extends Error` — `constructor(timeoutMs)`, `readonly timeoutMs`         | Thrown on timeout                                                                                                        |
| `runWorkbookWithTimeout` | `(source: string, options: {timeoutMs}) => Promise<SerializedRunResult>` | Runs a `.mtsw` source (continue-on-error) inside a `worker_threads` worker, always terminated before the promise settles |

`SerializedCellResult = {id, type, status, output?: string, error?}`;
`SerializedRunResult = {cells: SerializedCellResult[], ok: boolean}`. Cell
outputs are pre-formatted to strings via `formatResult` before crossing the
worker boundary (structured-clone can't faithfully reproduce engine class
instances like Complex/matrices/BigNumber).

## Constants

| Constant         | Value                  | Description                                                                                                            |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SCHEMA_VERSION` | `{major: 1, minor: 0}` | `--json` envelope shape version                                                                                        |
| `VERSION`        | `"0.1.0"`              | Engine version reported by `--version`/`capabilities`/serve (internal constant, distinct from the npm package version) |

## CLI (`mtsw`)

Command handlers are pure functions returning `{stdout, stderr, exitCode}` — no
direct console/`process.exit` — wired to real streams only in `main()`.

| Handler               | Signature                                    | Command                                     |
| --------------------- | -------------------------------------------- | ------------------------------------------- |
| `runCommand`          | `(args) => Promise<CommandResult>`           | `run` — run a workbook                      |
| `validateCommand`     | `(args) => CommandResult`                    | `validate` — validate a `.mtsw`             |
| `graphCommand`        | `(args) => CommandResult`                    | `graph` — emit the Mermaid dependency graph |
| `describeCommand`     | `(args) => CommandResult`                    | `describe`                                  |
| `capabilitiesCommand` | `(args) => CommandResult`                    | `capabilities`                              |
| `templatesCommand`    | `(args) => CommandResult`                    | `templates`                                 |
| `functionsCommand`    | `(args) => CommandResult`                    | `functions`                                 |
| `metaCommand`         | `(args) => CommandResult`                    | `meta`                                      |
| `exportCommand`       | `(args) => Promise<CommandResult>`           | `export`                                    |
| `stripCommand`        | `(args) => CommandResult`                    | `strip` — remove cell outputs               |
| `newCommand`          | `(args) => CommandResult`                    | `new`                                       |
| `importCommand`       | `(args) => CommandResult`                    | `import`                                    |
| `cellCommand`         | `(args) => CommandResult`                    | `cell` — cell mutation ops                  |
| `serveCommand`        | `() => Promise<CommandResult>`               | `serve`                                     |
| `runServer`           | `(input?, output?) => Promise<void>`         | JSON-RPC-over-stdio server loop (NDJSON)    |
| `dispatch`            | `(argv: string[]) => Promise<CommandResult>` | Route argv to a handler                     |

`interface CommandResult {stdout: string, stderr: string, exitCode: number}`.

## Example

```typescript
import { parseWorkbook, createExecutor } from '@danielsimonjr/mathts-workbook';

const { success, workbook } = parseWorkbook(mtswSource);
if (success && workbook) {
  const exec = createExecutor(workbook);
  const report = await exec.runReport(); // continue-on-error
  console.log(report.ok, report.cells);
}
```
