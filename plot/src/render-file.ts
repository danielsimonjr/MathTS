/**
 * Node-only render bridge: write plot output to PNG/PDF/SVG files by shelling
 * out to external tools already on the user's PATH. Bundles NO rendering deps —
 * preserves plot's zero-dependency guarantee. Exposed via the `./render` subpath
 * so `node:child_process`/`node:fs` never enter the browser-safe main bundle.
 */
import { spawn } from 'node:child_process';
import { writeFile, rm, rename, mkdtemp, readFile } from 'node:fs/promises';
import { extname, join as joinPath } from 'node:path';
import { tmpdir } from 'node:os';

/** Thrown when an external tool is missing or a conversion fails. Deliberate
 *  exception to plot's never-throw rule: I/O and missing tools must surface. */
export class PlotRenderError extends Error {
  constructor(
    message: string,
    readonly missingTool?: string
  ) {
    super(message);
    this.name = 'PlotRenderError';
  }
}

export interface RenderOptions {
  tool?: string;
  timeoutMs?: number;
  density?: number;
  background?: string;
  /** Enable LaTeX \write18 shell-escape. UNSAFE for untrusted TeX — allows
   *  arbitrary command execution during compile. Default false. */
  shellEscape?: boolean;
}

interface RunResult {
  code: number | null;
  stdout: Buffer;
  stderr: string;
}

/** Spawn a command, feeding optional stdin, collecting stdout/stderr. Rejects
 *  with PlotRenderError(ENOENT) if the binary is not found. */
export function runTool(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; input?: string } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { timeout: opts.timeoutMs ?? 30000 });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', (e: NodeJS.ErrnoException) =>
      reject(new PlotRenderError(`${cmd} could not be run: ${e.message}`, cmd))
    );
    child.on('close', (code) => resolve({ code, stdout: Buffer.concat(out), stderr: err }));
    if (opts.input !== undefined) {
      child.stdin.end(opts.input);
    }
  });
}

/** True if `name` responds to a version probe (i.e. is on PATH). */
export async function hasTool(name: string): Promise<boolean> {
  try {
    const r = await runTool(name, ['--version'], { timeoutMs: 5000 });
    return r.code === 0;
  } catch {
    return false;
  }
}

/** SVG string → file. Extension of `outPath` selects the target: `.svg` writes
 *  the SVG through; `.png`/`.pdf` convert via rsvg-convert (preferred) or resvg.
 *  Rejects with PlotRenderError naming the tool to install if none is present. */
export async function renderToFile(
  svg: string,
  outPath: string,
  opts: RenderOptions = {}
): Promise<void> {
  const ext = extname(outPath).toLowerCase();
  if (ext === '.svg') {
    await writeFile(outPath, svg, 'utf-8');
    return;
  }
  if (ext !== '.png' && ext !== '.pdf') {
    throw new PlotRenderError(
      `Unsupported output extension '${ext}' (expected .svg, .png, or .pdf)`
    );
  }
  const format = ext.slice(1); // 'png' | 'pdf'
  const candidates = opts.tool ? [opts.tool] : ['rsvg-convert', 'resvg'];
  for (const tool of candidates) {
    if (!(await hasTool(tool))) continue;
    const tmpOut = outPath + '.tmp';
    if (tool === 'rsvg-convert') {
      const args = ['-f', format, '-o', tmpOut];
      if (format === 'png' && opts.density)
        args.push('--dpi-x', String(opts.density), '--dpi-y', String(opts.density));
      if (format === 'png' && opts.background) args.push('--background-color', opts.background);
      const r = await runTool('rsvg-convert', args, { timeoutMs: opts.timeoutMs, input: svg });
      if (r.code !== 0) {
        await rm(tmpOut, { force: true });
        throw new PlotRenderError(`rsvg-convert failed: ${r.stderr}`);
      }
      await rename(tmpOut, outPath);
      return;
    }
    // resvg reads an input SVG path; write svg to a temp file alongside outPath
    const tmpSvg = outPath + '.tmp.svg';
    await writeFile(tmpSvg, svg, 'utf-8');
    try {
      const args = [tmpSvg, tmpOut];
      const r = await runTool('resvg', args, { timeoutMs: opts.timeoutMs });
      if (r.code !== 0) {
        await rm(tmpOut, { force: true });
        throw new PlotRenderError(`resvg failed: ${r.stderr}`);
      }
    } finally {
      await rm(tmpSvg, { force: true });
    }
    if (format === 'pdf') {
      await rm(tmpOut, { force: true });
      throw new PlotRenderError(
        'resvg does not emit PDF; install rsvg-convert for SVG→PDF',
        'rsvg-convert'
      );
    }
    await rename(tmpOut, outPath);
    return;
  }
  throw new PlotRenderError(
    `No SVG converter found for .${format}. Install rsvg-convert (librsvg) or resvg and ensure it is on PATH.`,
    'rsvg-convert'
  );
}

/** Build the CLI args for a LaTeX engine. Shell-escape (\write18) is OFF unless
 *  `shellEscape` is true — enabling it is UNSAFE for untrusted TeX (arbitrary
 *  command execution during compile). */
export function latexArgs(
  engine: string,
  workDir: string,
  texPath: string,
  shellEscape: boolean
): string[] {
  if (engine === 'tectonic') {
    // tectonic: shell-escape is off by default; only add the enabling flag when asked.
    return [...(shellEscape ? ['-Z', 'shell-escape'] : []), '--outdir', workDir, texPath];
  }
  // pdflatex/xelatex/lualatex: explicitly pass -no-shell-escape by default.
  return [
    shellEscape ? '-shell-escape' : '-no-shell-escape',
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-output-directory',
    workDir,
    texPath,
  ];
}

/** Standalone LaTeX/TikZ source → PDF via pdflatex (preferred) or tectonic.
 *  Compiles in an OS temp dir and copies the resulting PDF to `outPath`.
 *  Rejects with PlotRenderError naming the engine to install if none is found. */
export async function latexToPdf(
  texSource: string,
  outPath: string,
  opts: RenderOptions = {}
): Promise<void> {
  if (extname(outPath).toLowerCase() !== '.pdf') {
    throw new PlotRenderError(`latexToPdf output must be a .pdf path (got '${outPath}')`);
  }
  const candidates = opts.tool ? [opts.tool] : ['pdflatex', 'tectonic'];
  let engine: string | undefined;
  for (const c of candidates) {
    if (await hasTool(c)) {
      engine = c;
      break;
    }
  }
  if (!engine) {
    throw new PlotRenderError(
      'No LaTeX engine found. Install TeX Live (pdflatex) or tectonic and ensure it is on PATH.',
      'pdflatex'
    );
  }
  const work = await mkdtemp(joinPath(tmpdir(), 'plot-tex-'));
  try {
    const texPath = joinPath(work, 'doc.tex');
    await writeFile(texPath, texSource, 'utf-8');
    const args = latexArgs(engine, work, texPath, opts.shellEscape === true);
    const r = await runTool(engine, args, { timeoutMs: opts.timeoutMs ?? 60000 });
    const pdfPath = joinPath(work, 'doc.pdf');
    let pdf: Buffer;
    try {
      pdf = await readFile(pdfPath);
    } catch {
      throw new PlotRenderError(
        `${engine} produced no PDF (exit ${r.code}): ${r.stderr || r.stdout.toString().slice(-500)}`
      );
    }
    await writeFile(outPath, pdf);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
