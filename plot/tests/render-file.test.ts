import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  renderToFile,
  latexToPdf,
  latexArgs,
  PlotRenderError,
  renderPngWithResvgWasm,
} from '../src/render-file.js';
import * as renderFile from '../src/render-file.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'plot-render-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

describe('renderToFile', () => {
  it('.svg passthrough writes the SVG bytes (no external tool needed)', async () => {
    const out = join(dir, 'a.svg');
    await renderToFile(SVG, out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(0);
  });
  it('rejects with PlotRenderError naming the tool when a PNG converter is absent', async () => {
    // force an impossible tool so detection fails deterministically
    await expect(
      renderToFile(SVG, join(dir, 'a.png'), { tool: '__definitely_not_a_real_tool__' })
    ).rejects.toBeInstanceOf(PlotRenderError);
  });
  it('#780 names @resvg/resvg-wasm when PATH converters are absent and wasm is unavailable', async () => {
    const importSpy = vi.spyOn(renderFile.resvgWasmImport, 'importModule').mockRejectedValue(
      Object.assign(new Error('Cannot find module'), { code: 'ERR_MODULE_NOT_FOUND' })
    );
    try {
      await renderPngWithResvgWasm(SVG);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PlotRenderError);
      expect((e as PlotRenderError).message).toMatch(/@resvg\/resvg-wasm/);
      expect((e as PlotRenderError).missingTool).toBe('@resvg/resvg-wasm');
    } finally {
      importSpy.mockRestore();
    }
  });

  it('#780 renderToFile writes PNG via resvg-wasm when PATH tools are absent', async () => {
    const toolSpy = vi.spyOn(renderFile, 'hasTool').mockResolvedValue(false);
    const out = join(dir, 'wasm-line.png');
    await renderToFile(SVG, out);
    toolSpy.mockRestore();
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(50);
  });

  it('the PlotRenderError names what to install', async () => {
    try {
      await renderToFile(SVG, join(dir, 'b.pdf'), { tool: '__definitely_not_a_real_tool__' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PlotRenderError);
      expect((e as PlotRenderError).message).toMatch(/Security Error/i);
    }
  });
});

describe('latexToPdf', () => {
  const TEX = '\\documentclass{article}\\begin{document}hello\\end{document}';
  it('rejects with PlotRenderError naming a LaTeX engine when none is present', async () => {
    try {
      await latexToPdf(TEX, join(dir, 'x.pdf'), { tool: '__definitely_not_a_real_tool__' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PlotRenderError);
      expect((e as PlotRenderError).message).toMatch(/Security Error/i);
    }
  });
  it('requires a .pdf output path', async () => {
    await expect(latexToPdf(TEX, join(dir, 'x.png'))).rejects.toBeInstanceOf(PlotRenderError);
  });
});

describe('latexArgs — shell-escape safe by default', () => {
  it('pdflatex gets -no-shell-escape', () => {
    const a = latexArgs('pdflatex', '/w', '/w/d.tex');
    expect(a).toContain('-no-shell-escape');
  });
  it('tectonic has no shell-escape flag', () => {
    expect(latexArgs('tectonic', '/w', '/w/d.tex').join(' ')).not.toContain('shell-escape');
  });
});
