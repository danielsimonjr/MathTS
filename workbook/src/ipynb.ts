/**
 * Assemble a generic RenderDoc into a Jupyter notebook (nbformat v4) JSON
 * string — the ipynb analog of html.ts's toHTML / tex.ts's toTeX. Operates on
 * the same plain `RenderDoc`/`RenderCell` model built by the CLI's
 * `buildRenderDoc`, so it shares the exact same cell/result mapping as the
 * other exporters instead of re-deriving it from the `Workbook` type.
 *
 * Cell mapping:
 *  - `markdown` -> an nbformat markdown cell (raw content as source).
 *  - everything else (`equation`, `code`, `test`, `data`, `chart`) -> an
 *    nbformat code cell. A computed result becomes an `execute_result`
 *    output; an error becomes an `error` output; a rendered chart becomes a
 *    `display_data` output (inline SVG); a `test` cell's pass/fail becomes an
 *    `execute_result` of `"true"`/`"false"`. A cell with none of these (e.g.
 *    an unevaluated `equation`, or `--no-run`) gets an empty `outputs` array
 *    and `execution_count: null`, which is valid nbformat v4.
 *
 * `source` fields follow the nbformat convention: an array of lines, each
 * (except possibly the last) retaining its trailing `\n`.
 */

import type { RenderDoc, RenderCell } from './html.js';

interface ExecuteResultOutput {
  output_type: 'execute_result';
  data: Record<string, string[]>;
  metadata: Record<string, unknown>;
  execution_count: number;
}

interface ErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

interface DisplayDataOutput {
  output_type: 'display_data';
  data: Record<string, string[]>;
  metadata: Record<string, unknown>;
}

type IpynbOutput = ExecuteResultOutput | ErrorOutput | DisplayDataOutput;

interface MarkdownIpynbCell {
  cell_type: 'markdown';
  source: string[];
  metadata: Record<string, unknown>;
}

interface CodeIpynbCell {
  cell_type: 'code';
  source: string[];
  metadata: Record<string, unknown>;
  execution_count: number | null;
  outputs: IpynbOutput[];
}

type IpynbCell = MarkdownIpynbCell | CodeIpynbCell;

interface IpynbNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: IpynbCell[];
}

/** nbformat convention: an array of lines, each keeping its trailing `\n` except the last. */
function toSourceLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  return lines.map((line, i) => (i < lines.length - 1 ? `${line}\n` : line));
}

function textData(text: string): Record<string, string[]> {
  return { 'text/plain': toSourceLines(text) };
}

/** A monotonically increasing execution counter shared across a notebook's code cells. */
interface Counter {
  n: number;
}

function renderCodeCell(cell: RenderCell, counter: Counter): CodeIpynbCell {
  const outputs: IpynbOutput[] = [];
  let executionCount: number | null = null;

  if (cell.error !== undefined) {
    outputs.push({
      output_type: 'error',
      ename: 'Error',
      evalue: cell.error,
      traceback: [cell.error],
    });
  } else if (cell.type === 'chart') {
    if (cell.chartSvg !== undefined) {
      outputs.push({
        output_type: 'display_data',
        data: { 'image/svg+xml': toSourceLines(cell.chartSvg), 'text/plain': ['<chart>'] },
        metadata: {},
      });
    }
  } else if (cell.type === 'test' && cell.passed !== undefined) {
    executionCount = counter.n++;
    outputs.push({
      output_type: 'execute_result',
      data: textData(cell.passed ? 'true' : 'false'),
      metadata: {},
      execution_count: executionCount,
    });
  } else if (cell.output !== undefined) {
    executionCount = counter.n++;
    outputs.push({
      output_type: 'execute_result',
      data: textData(cell.output),
      metadata: {},
      execution_count: executionCount,
    });
  }

  return {
    cell_type: 'code',
    source: toSourceLines(cell.content),
    metadata: {},
    execution_count: executionCount,
    outputs,
  };
}

function renderIpynbCell(cell: RenderCell, counter: Counter): IpynbCell {
  if (cell.type === 'markdown') {
    return { cell_type: 'markdown', source: toSourceLines(cell.content), metadata: {} };
  }
  return renderCodeCell(cell, counter);
}

/** Render a document structure to a Jupyter notebook (nbformat v4) JSON string. */
export function toIpynb(doc: RenderDoc): string {
  const counter: Counter = { n: 1 };
  const cells = doc.cells.map((cell) => renderIpynbCell(cell, counter));

  const mathts: Record<string, unknown> = {};
  if (doc.title !== undefined) mathts.title = doc.title;
  if (doc.author !== undefined) mathts.author = doc.author;
  if (doc.description !== undefined) mathts.description = doc.description;
  if (doc.tags !== undefined) mathts.tags = doc.tags;

  const notebook: IpynbNotebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      mathts,
      language_info: { name: 'mathts', file_extension: '.mtsw' },
    },
    cells,
  };

  return JSON.stringify(notebook, null, 2);
}
