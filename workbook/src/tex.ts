/**
 * Assemble a RenderDoc into one self-contained LaTeX document (or a fragment
 * for \input) — the TeX analog of html.ts's toHTML. Markdown prose via
 * markdownToTex, equations via the injected parser's .toTex(), code via
 * listings, tests as colored status lines, charts as embedded TikZ. All plain
 * text is LaTeX-escaped; never throws.
 */

import type { RenderDoc, RenderCell } from './html.js';
import { markdownToTex, texEscape } from './markdown.js';

export interface ToTexOptions {
  /** Parser for equation expressions (e.g. the functions package `parse`). */
  parse?: (expr: string) => unknown;
  /** Emit only the cell bodies (for \input) instead of a standalone document. */
  fragment?: boolean;
}

const PREAMBLE = [
  '\\documentclass{article}',
  '\\usepackage{amsmath}',
  '\\usepackage{tikz}',
  '\\usepackage{listings}',
  '\\usepackage{xcolor}',
  '\\usepackage[margin=1in]{geometry}',
  '\\usepackage{hyperref}',
].join('\n');

function renderEquationTex(content: string, parse?: (expr: string) => unknown): string {
  if (parse) {
    try {
      const node = parse(content) as { toTex(): string };
      return `\\[ ${node.toTex()} \\]`;
    } catch {
      /* fall through to escaped source */
    }
  }
  return `\\[ ${texEscape(content)} \\]`;
}

function renderCellTex(cell: RenderCell, parse?: (expr: string) => unknown): string {
  switch (cell.type) {
    case 'markdown':
      return markdownToTex(cell.content);
    case 'equation':
      return renderEquationTex(cell.content, parse);
    case 'code': {
      const cap = cell.id ? `\\textit{${texEscape(cell.id)}}\\\\\n` : '';
      const src = `\\begin{lstlisting}\n${cell.content}\n\\end{lstlisting}`;
      let res = '';
      if (cell.error !== undefined)
        res = `\n\n\\textcolor{red}{\\texttt{${texEscape(cell.error)}}}`;
      else if (cell.output !== undefined)
        res = `\n\n\\begin{verbatim}\n${cell.output}\n\\end{verbatim}`;
      return `${cap}${src}${res}`;
    }
    case 'test': {
      const label = `\\texttt{${texEscape(cell.content)}}`;
      if (cell.error !== undefined)
        return `\\textcolor{orange}{[ERROR]} ${label} --- ${texEscape(cell.error)}`;
      if (cell.passed === true) return `\\textcolor{green!60!black}{[PASS]} ${label}`;
      if (cell.passed === false) return `\\textcolor{red}{[FAIL]} ${label}`;
      return `\\textcolor{gray}{[NOT RUN]} ${label}`;
    }
    case 'data': {
      const val = cell.error !== undefined ? cell.error : (cell.output ?? '');
      const cap = cell.id ? `\\textit{${texEscape(cell.id)}}\\\\\n` : '';
      return `${cap}\\begin{verbatim}\n${val}\n\\end{verbatim}`;
    }
    case 'chart': {
      const chart = cell.chartTikz ?? '% no chart';
      const note = cell.note ? `\n\n\\textit{${texEscape(cell.note)}}` : '';
      return `\\begin{center}\n${chart}\n\\end{center}${note}`;
    }
    default:
      return `\\begin{verbatim}\n${cell.content}\n\\end{verbatim}`;
  }
}

/** Render a document structure to a standalone (or fragment) LaTeX string. Never throws. */
export function toTeX(doc: RenderDoc, options: ToTexOptions = {}): string {
  const body = doc.cells.map((c) => renderCellTex(c, options.parse)).join('\n\n');
  if (options.fragment) return body;
  const meta: string[] = [];
  if (doc.title) meta.push(`\\title{${texEscape(doc.title)}}`);
  if (doc.author) meta.push(`\\author{${texEscape(doc.author)}}`);
  const maketitle = doc.title ? '\\maketitle\n' : '';
  return [PREAMBLE, ...meta, '\\begin{document}', `${maketitle}${body}`, '\\end{document}'].join(
    '\n'
  );
}
