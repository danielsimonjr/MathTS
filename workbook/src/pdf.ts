/**
 * Render a workbook RenderDoc to a PDF file. Reuses plot's latexToPdf primitive:
 * toTeX(standalone) → LaTeX → PDF. Charts render as native vector TikZ (no
 * rasterization). Async; throws PlotRenderError if no LaTeX engine is available.
 */
import { latexToPdf, type RenderOptions } from '@danielsimonjr/mathts-plot/render';
import { toTeX } from './tex.js';
import type { RenderDoc } from './html.js';

/**
 * Options for `toPDF()`: the render options of the plot package, plus the expression
 * parser for equation cells.
 */
export interface ToPdfOptions extends RenderOptions {
  parse?: (expr: string) => unknown;
}

/**
 * Render a document to a PDF file. The function makes a standalone document with
 * `toTeX()` and gives it to `latexToPdf()` from the plot package.
 *
 * @param doc - The document to render.
 * @param outPath - The path of the PDF file to write.
 * @param options - The expression parser and the render options.
 * @returns A promise that resolves when `latexToPdf()` completes. It rejects if
 * `latexToPdf()` fails.
 */
export function toPDF(doc: RenderDoc, outPath: string, options: ToPdfOptions = {}): Promise<void> {
  const { parse, ...renderOpts } = options;
  return latexToPdf(toTeX(doc, { parse, fragment: false }), outPath, renderOpts);
}
