# Export-Formats Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PNG/PDF chart output, Markdown-embeddable math, Graphviz DOT (expression trees + notebook graphs), and workbook JSON/PDF export to MathTS — preserving plot's zero-dependency guarantee via an external-tool bridge.

**Architecture:** Expression `Node` gains `.toMarkdown`/`.toDOT` (pure string). plot gains a Node-only `./render` subpath (`render-file.ts`) that shells out to external tools (rsvg-convert/resvg for SVG→PNG/PDF; pdflatex/tectonic for LaTeX→PDF) — no bundled deps. workbook gains `toDOT(graph)`, `export --format json` (executed run report), and `toPDF`/`export --format pdf` which reuse plot's `latexToPdf` (workbook already depends on plot; plot has no edge back, so no cycle).

**Tech Stack:** TypeScript (ESM, ES2022), tsup, vitest, Node built-ins (`node:child_process`, `node:fs/promises`, `node:os`, `node:path`), changesets.

## Global Constraints

- Commit footer, exactly, on every commit:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK`
- Never `--no-verify` / `--no-gpg-sign` / skip hooks. Pre-commit hook is slow (allow ~540000ms on the commit).
- Tests import built `dist/` — run `npx turbo build --filter=<pkg>` before downstream vitest.
- DGT gate every task: `npm run docs:deps` → **0 circular dependencies, 0 NEW dormant**. Do NOT run the generator with `--all` (it writes the dormant-included variant and pollutes the committed graph). The pre-commit hook regenerates `docs/Architecture/*`; include those regenerated files in the commit.
- TDD strict (RED before GREEN); no dead code; no `any` / `@ts-nocheck` / blanket eslint-disable.
- Never-throw preserved for chart builders + expression serializers; the render/PDF bridges are explicitly-throwing async I/O APIs.
- Verify each push L==R (`git rev-parse HEAD` == `git ls-remote origin -h refs/heads/main | cut -f1`).
- **plot** → minor changeset (publishes). **expression** → minor changeset (publishes). **workbook** → patch changeset (changeset-**ignored**, versions internally, does NOT publish).
- Vitest: always `import { describe, it, expect } from 'vitest'` explicitly.

## File Structure

- `expression/src/node/Node.ts` (MODIFY) — add `toMarkdown` + `toDOT` on the base factory object; add a small `dotEscape`/`nodeLabel` helper (same file or `expression/src/node/utils/`).
- `plot/src/render-file.ts` (CREATE) — `PlotRenderError`, `renderToFile`, `latexToPdf`, tool detection.
- `plot/package.json` (MODIFY) — add `"./render"` export + `src/render-file.ts` to the tsup build entry.
- `workbook/src/graph.ts` (MODIFY) — add `toDOT(graph)`.
- `workbook/src/cli.ts` (MODIFY) — `graph -f dot`; `export --format json|pdf`.
- `workbook/src/pdf.ts` (CREATE) — `toPDF(doc, outPath, opts)`.
- `workbook/package.json` (MODIFY) — bump `@danielsimonjr/mathts-plot` dep to the render-capable version.
- Tests: `expression/tests/node-markdown.test.ts`, `expression/tests/node-dot.test.ts`, `plot/tests/render-file.test.ts`, `workbook/tests/graph-dot.test.ts`, `workbook/tests/export-json.test.ts`, `workbook/tests/export-pdf.test.ts`.

---

### Task 1: expression `Node.toMarkdown()`

**Files:**

- Modify: `expression/src/node/Node.ts` (add method on the base factory object, next to `toTex`)
- Test: `expression/tests/node-markdown.test.ts`

**Interfaces:**

- Consumes: existing `this.toTex(options)` on Node; `StringOptions` type already imported in Node.ts.
- Produces: `toMarkdown(options?: { inline?: boolean } & StringOptions): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Node.toMarkdown', () => {
  it('wraps toTex in display math by default', () => {
    const node = parse('x^2 + 1');
    expect(node.toMarkdown()).toBe('$$\n' + node.toTex() + '\n$$');
  });
  it('wraps toTex in inline math when inline:true', () => {
    const node = parse('x^2 + 1');
    expect(node.toMarkdown({ inline: true })).toBe('$' + node.toTex() + '$');
  });
  it('passes StringOptions through to toTex', () => {
    const node = parse('a/b');
    const opts = { parenthesis: 'all' as const };
    expect(node.toMarkdown(opts)).toBe('$$\n' + node.toTex(opts) + '\n$$');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx turbo build --filter=@danielsimonjr/mathts-expression && npx vitest run expression/tests/node-markdown.test.ts`
Expected: FAIL — `toMarkdown is not a function`.

- [ ] **Step 3: Implement**

In `expression/src/node/Node.ts`, immediately after the `toTex(options)` method on the base factory object, add:

```ts
      /**
       * Render this node as Markdown-embeddable math. Display (block) math by
       * default (`$$…$$`), inline (`$…$`) when `options.inline` is true. Thin
       * wrapper over toTex(); adds no failure mode beyond toTex's own.
       * @param {Object} [options]
       * @return {string}
       */
      toMarkdown(options?: { inline?: boolean } & StringOptions): string {
        const tex = this.toTex(options);
        return options?.inline ? '$' + tex + '$' : '$$\n' + tex + '\n$$';
      },
```

(Note: match the surrounding member style — if members are comma-separated object properties, keep the trailing comma; if class methods, drop it. Follow the existing `toTex`/`toMathML` punctuation exactly.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx turbo build --filter=@danielsimonjr/mathts-expression && npx vitest run expression/tests/node-markdown.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Gate**

Run: `cd expression && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run expression/`
Expected: 0 type errors, 0 lint problems, full expression suite green.

- [ ] **Step 6: Commit** (do NOT push yet — Task 2 shares the expression changeset)

```bash
git add expression/src/node/Node.ts expression/tests/node-markdown.test.ts
git commit -m "$(cat <<'EOF'
feat(expression): Node.toMarkdown() — display/inline math wrapper over toTex

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

### Task 2: expression `Node.toDOT()`

**Files:**

- Modify: `expression/src/node/Node.ts` (add `toDOT` on the base factory object + a module-level `dotEscape`/`nodeLabel` helper)
- Test: `expression/tests/node-dot.test.ts`
- Create: `.changeset/expression-markdown-dot.md`

**Interfaces:**

- Consumes: `this.traverse(cb)` — `cb(node, path: string|null, parent: Node|null)`, pre-order (parent before children). Type guards `isConstantNode`, `isSymbolNode`, `isOperatorNode`, `isFunctionNode` from `expression/src/utils/is.js`. Node fields: `ConstantNode.value`, `SymbolNode.name`, `OperatorNode.op`, `FunctionNode.name`, and every node's `.type`.
- Produces: `toDOT(options?: { name?: string }): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';

describe('Node.toDOT', () => {
  it('emits a digraph with a node per AST node and parent→child edges', () => {
    const dot = parse('2 * x').toDOT();
    // structure (label text is our format; op symbol comes from the parser):
    expect(dot.startsWith('digraph AST {')).toBe(true);
    expect(dot.trimEnd().endsWith('}')).toBe(true);
    // 3 node declarations, 2 edges
    expect(dot.match(/\[label=/g)?.length).toBe(3);
    expect(dot.match(/ -> /g)?.length).toBe(2);
    // root is the operator, children are the constant and symbol
    expect(dot).toMatch(/n0 \[label="OperatorNode: /);
    expect(dot).toContain('ConstantNode: 2');
    expect(dot).toContain('SymbolNode: x');
    expect(dot).toContain('n0 -> n1;');
    expect(dot).toContain('n0 -> n2;');
  });
  it('DOT-escapes quotes and backslashes in labels', () => {
    const dot = parse('"a\\\\b"').toDOT(); // a string node containing a backslash
    expect(dot).not.toMatch(/label="[^"]*[^\\]"[^\]]/); // no unescaped inner quote breaks the attr
    expect(dot).toContain('\\\\'); // backslash escaped
  });
  it('honors options.name', () => {
    expect(parse('x').toDOT({ name: 'Tree' }).startsWith('digraph Tree {')).toBe(true);
  });
});
```

Run first to capture the exact operator label — `parse('2 * x').toDOT()` — and if `OperatorNode.op` renders differently than expected, keep the assertions above (they don't hard-code the op symbol) but confirm `n0` is the OperatorNode.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx turbo build --filter=@danielsimonjr/mathts-expression && npx vitest run expression/tests/node-dot.test.ts`
Expected: FAIL — `toDOT is not a function`.

- [ ] **Step 3: Implement**

At module scope in `Node.ts` (near the top, after imports), add helpers. Import the guards:

```ts
import { isConstantNode, isSymbolNode, isOperatorNode, isFunctionNode } from '../utils/is.js';
```

```ts
function dotEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function dotNodeLabel(node: Node): string {
  const t = node.type;
  if (isConstantNode(node)) return `${t}: ${String(node.value)}`;
  if (isSymbolNode(node)) return `${t}: ${node.name}`;
  if (isOperatorNode(node)) return `${t}: ${node.op}`;
  if (isFunctionNode(node)) return `${t}: ${node.name}`;
  return t;
}
```

On the base factory object, after `toMarkdown`, add:

```ts
      /**
       * Render the AST subtree rooted at this node as a Graphviz digraph: one
       * DOT node per AST node (label = node type + a value for leaves), with
       * parent→child edges. Never throws.
       * @param {Object} [options]
       * @return {string}
       */
      toDOT(options?: { name?: string }): string {
        const ids = new Map<Node, string>();
        const nodes: string[] = [];
        const edges: string[] = [];
        let counter = 0;
        this.traverse((node: Node, _path: string | null, parent: Node | null) => {
          const id = 'n' + counter++;
          ids.set(node, id);
          nodes.push(`  ${id} [label="${dotEscape(dotNodeLabel(node))}"];`);
          if (parent) {
            const pid = ids.get(parent);
            if (pid) edges.push(`  ${pid} -> ${id};`);
          }
        });
        const name = options?.name ?? 'AST';
        return `digraph ${name} {\n${nodes.concat(edges).join('\n')}\n}`;
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx turbo build --filter=@danielsimonjr/mathts-expression && npx vitest run expression/tests/node-dot.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate**

Run: `cd expression && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run expression/ && npm run docs:deps`
Expected: 0 type errors, 0 lint, full suite green, **0 cycles / 0 new dormant**.

- [ ] **Step 6: Changeset + CHANGELOG**

Create `.changeset/expression-markdown-dot.md`:

```markdown
---
'@danielsimonjr/mathts-expression': minor
---

Add two AST node serializers: `Node.toMarkdown()` (display/inline math wrapper over `toTex`) and `Node.toDOT()` (Graphviz digraph of the expression tree).
```

Add a `## [Unreleased]` entry to root `CHANGELOG.md` under an `### Added` heading (expression: `Node.toMarkdown` and `Node.toDOT`).

- [ ] **Step 7: Commit + push**

```bash
git add expression/src/node/Node.ts expression/tests/node-dot.test.ts .changeset/expression-markdown-dot.md CHANGELOG.md docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(expression): Node.toDOT() — Graphviz digraph of the AST

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
git push origin main
```

Verify L==R.

---

### Task 3: plot render bridge — `renderToFile` (SVG→file) + `./render` wiring

**Files:**

- Create: `plot/src/render-file.ts`
- Modify: `plot/package.json` (add `"./render"` export + `src/render-file.ts` to tsup build)
- Test: `plot/tests/render-file.test.ts`

**Interfaces:**

- Produces:
  - `class PlotRenderError extends Error { readonly missingTool?: string }`
  - `interface RenderOptions { tool?: string; timeoutMs?: number; density?: number; background?: string }`
  - `renderToFile(svg: string, outPath: string, opts?: RenderOptions): Promise<void>` — `.svg` writes through; `.png`/`.pdf` convert via rsvg-convert (preferred) or resvg; missing tool → `PlotRenderError`.
  - a private `runTool(cmd, args, {timeoutMs})` + `hasTool(name)` used by Task 4 too.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToFile, PlotRenderError } from '../src/render-file.js';

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
  it('the PlotRenderError names what to install', async () => {
    try {
      await renderToFile(SVG, join(dir, 'b.pdf'), { tool: '__definitely_not_a_real_tool__' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PlotRenderError);
      expect((e as PlotRenderError).message).toMatch(/rsvg-convert|resvg|install/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run plot/tests/render-file.test.ts`
Expected: FAIL — cannot resolve `../src/render-file.js`.

- [ ] **Step 3: Implement `plot/src/render-file.ts`**

```ts
/**
 * Node-only render bridge: write plot output to PNG/PDF/SVG files by shelling
 * out to external tools already on the user's PATH. Bundles NO rendering deps —
 * preserves plot's zero-dependency guarantee. Exposed via the `./render` subpath
 * so `node:child_process`/`node:fs` never enter the browser-safe main bundle.
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

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
    if (tool === 'rsvg-convert') {
      const args = ['-f', format, '-o', outPath];
      if (format === 'png' && opts.density)
        args.push('--dpi-x', String(opts.density), '--dpi-y', String(opts.density));
      if (format === 'png' && opts.background) args.push('--background-color', opts.background);
      const r = await runTool('rsvg-convert', args, { timeoutMs: opts.timeoutMs, input: svg });
      if (r.code !== 0) throw new PlotRenderError(`rsvg-convert failed: ${r.stderr}`);
      return;
    }
    // resvg reads an input SVG path; write svg to a temp file alongside outPath
    const tmpSvg = outPath + '.tmp.svg';
    await writeFile(tmpSvg, svg, 'utf-8');
    try {
      const args = [tmpSvg, outPath];
      const r = await runTool('resvg', args, { timeoutMs: opts.timeoutMs });
      if (r.code !== 0) throw new PlotRenderError(`resvg failed: ${r.stderr}`);
    } finally {
      const { rm } = await import('node:fs/promises');
      await rm(tmpSvg, { force: true });
    }
    if (format === 'pdf') {
      throw new PlotRenderError(
        'resvg does not emit PDF; install rsvg-convert for SVG→PDF',
        'rsvg-convert'
      );
    }
    return;
  }
  throw new PlotRenderError(
    `No SVG converter found for .${format}. Install rsvg-convert (librsvg) or resvg and ensure it is on PATH.`,
    'rsvg-convert'
  );
}
```

(Note: resvg cannot emit PDF; the code routes PDF to rsvg-convert and errors clearly if only resvg is present. This matches the spec's "rsvg-convert (preferred) or resvg".)

- [ ] **Step 4: Wire the `./render` entry**

In `plot/package.json`: change `exports` to

```json
"exports": {
  ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
  "./render": { "import": "./dist/render-file.js", "types": "./dist/render-file.d.ts" }
}
```

and change the build script from `tsup src/index.ts --format esm --dts --clean` to
`tsup src/index.ts src/render-file.ts --format esm --dts --clean`.

- [ ] **Step 5: Run tests**

Run: `npx turbo build --filter=@danielsimonjr/mathts-plot && npx vitest run plot/tests/render-file.test.ts`
Expected: PASS (the `.svg` passthrough always works; the missing-tool cases assert `PlotRenderError`).

- [ ] **Step 6: Gate**

Run: `cd plot && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run plot/ && npm run docs:deps`
Expected: 0 type errors, 0 lint, full plot suite green (incl. golden — unchanged), **0 cycles and `render-file.ts` reachable (NOT dormant)** because `./render` is now an `exports` root.

- [ ] **Step 7: Commit** (do NOT push — Task 4 shares the plot changeset)

```bash
git add plot/src/render-file.ts plot/package.json plot/tests/render-file.test.ts docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(plot): Node-only ./render bridge — renderToFile (SVG→PNG/PDF), zero bundled deps

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

### Task 4: plot render bridge — `latexToPdf`

**Files:**

- Modify: `plot/src/render-file.ts` (add `latexToPdf`, reusing `runTool`/`hasTool`)
- Test: `plot/tests/render-file.test.ts` (extend)
- Create: `.changeset/plot-render-bridge.md`

**Interfaces:**

- Consumes: `runTool`, `hasTool`, `PlotRenderError`, `RenderOptions` from Task 3.
- Produces: `latexToPdf(texSource: string, outPath: string, opts?: RenderOptions): Promise<void>` — standalone LaTeX → PDF via pdflatex (preferred) or tectonic; the shared primitive workbook.toPDF reuses.

- [ ] **Step 1: Write the failing test** (append to `render-file.test.ts`)

```ts
import { latexToPdf } from '../src/render-file.js';

describe('latexToPdf', () => {
  const TEX = '\\documentclass{article}\\begin{document}hello\\end{document}';
  it('rejects with PlotRenderError naming a LaTeX engine when none is present', async () => {
    await expect(
      latexToPdf(TEX, join(dir, 'x.pdf'), { tool: '__definitely_not_a_real_tool__' })
    ).rejects.toBeInstanceOf(PlotRenderError);
  });
  it('requires a .pdf output path', async () => {
    await expect(latexToPdf(TEX, join(dir, 'x.png'))).rejects.toBeInstanceOf(PlotRenderError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run plot/tests/render-file.test.ts`
Expected: FAIL — `latexToPdf` not exported.

- [ ] **Step 3: Implement `latexToPdf`** (append to `render-file.ts`)

```ts
import { mkdtemp, readFile, writeFile as writeFileP, rm as rmP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';

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
    await writeFileP(texPath, texSource, 'utf-8');
    const args =
      engine === 'tectonic'
        ? ['--outdir', work, texPath]
        : ['-interaction=nonstopmode', '-halt-on-error', '-output-directory', work, texPath];
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
    await writeFileP(outPath, pdf);
  } finally {
    await rmP(work, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx turbo build --filter=@danielsimonjr/mathts-plot && npx vitest run plot/tests/render-file.test.ts`
Expected: PASS (all render-file tests).

- [ ] **Step 5: Gate**

Run: `cd plot && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run plot/ && npm run docs:deps`
Expected: clean; 0 cycles / 0 new dormant.

- [ ] **Step 6: Changeset + CHANGELOG**

`.changeset/plot-render-bridge.md`:

```markdown
---
'@danielsimonjr/mathts-plot': minor
---

Add a Node-only `./render` subpath: `renderToFile(svg, out)` (SVG→PNG/PDF via rsvg-convert/resvg) and `latexToPdf(tex, out)` (LaTeX/TikZ→PDF via pdflatex/tectonic). External-tool bridge — no bundled rendering dependencies; the main entry stays browser-safe and zero-dependency.
```

Add root `CHANGELOG.md` `### Added` entry (plot `./render`: renderToFile + latexToPdf).

- [ ] **Step 7: Commit + push**

```bash
git add plot/src/render-file.ts plot/tests/render-file.test.ts .changeset/plot-render-bridge.md CHANGELOG.md docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(plot): latexToPdf — shared LaTeX/TikZ→PDF primitive on the ./render bridge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
git push origin main
```

Verify L==R. **After this push, publish is deferred to the controller's release step** (do not publish mid-plan).

---

### Task 5: workbook `toDOT(graph)` + `mtsw graph -f dot`

**Files:**

- Modify: `workbook/src/graph.ts` (add `toDOT`)
- Modify: `workbook/src/cli.ts` (`graphCommand`: handle `-f dot`)
- Test: `workbook/tests/graph-dot.test.ts`

**Interfaces:**

- Consumes: `DependencyGraph { nodes: Map<string, DependencyNode>; executionOrder: string[] }`; `DependencyNode { id; dependencies: string[]; dependents: string[] }`. Existing `toMermaid(graph)` is the sibling to mirror.
- Produces: `toDOT(graph: DependencyGraph): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, toDOT } from '../src/graph.js';

describe('toDOT(graph)', () => {
  it('emits a digraph with a node per cell and dep→cell edges', () => {
    const graph = buildDependencyGraph([
      { id: 'a', type: 'data', content: '1' },
      { id: 'b', type: 'code', content: 'a + 1' },
    ] as never);
    const dot = toDOT(graph);
    expect(dot.startsWith('digraph deps {')).toBe(true);
    expect(dot.trimEnd().endsWith('}')).toBe(true);
    expect(dot).toContain('a [label="a"];');
    expect(dot).toContain('b [label="b"];');
    expect(dot).toContain('a -> b;');
  });
});
```

(Confirm the exact `Cell` shape needed by `buildDependencyGraph` from `workbook/src/graph.ts` / `types.ts`; a `code` cell referencing `a` must produce a dependency `a` for `b`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/graph-dot.test.ts`
Expected: FAIL — `toDOT` not exported.

- [ ] **Step 3: Implement** (in `workbook/src/graph.ts`, next to `toMermaid`)

```ts
/**
 * Render the dependency graph as Graphviz DOT (the DOT analog of toMermaid).
 * Cell ids are validated identifiers ([A-Za-z_][A-Za-z0-9_]*), safe verbatim as
 * both node id and quoted label; no cell content appears in the output.
 */
export function toDOT(graph: DependencyGraph): string {
  const lines: string[] = ['digraph deps {'];
  for (const id of graph.nodes.keys()) {
    lines.push(`  ${id} [label="${id}"];`);
  }
  for (const [id, node] of graph.nodes) {
    for (const dep of node.dependencies) {
      lines.push(`  ${dep} -> ${id};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}
```

- [ ] **Step 4: Wire `graph -f dot`** in `workbook/src/cli.ts`

Import `toDOT` alongside `toMermaid` (line ~20). In `graphCommand`, after the mermaid branch, add before the default text output:

```ts
if (flagValue(args, '-f') === 'dot' || flagValue(args, '--format') === 'dot') {
  return { stdout: toDOT(graph), stderr: '', exitCode: 0 };
}
```

Update the usage string to `mtsw graph <file> [-f mermaid|dot]`.

- [ ] **Step 5: Run tests**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/graph-dot.test.ts workbook/tests/graph-mermaid.test.ts workbook/tests/cli.test.ts`
Expected: new test PASS; existing graph/cli tests still green.

- [ ] **Step 6: Gate + commit** (do NOT push — Task 7 adds the workbook changeset)

Run: `cd workbook && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run workbook/ && npm run docs:deps`
Then:

```bash
git add workbook/src/graph.ts workbook/src/cli.ts workbook/tests/graph-dot.test.ts docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(workbook): toDOT(graph) + mtsw graph -f dot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

### Task 6: workbook `mtsw export --format json`

**Files:**

- Modify: `workbook/src/cli.ts` (`exportCommand`: accept `--format json`)
- Test: `workbook/tests/export-json.test.ts`

**Interfaces:**

- Consumes: `createExecutor(workbook).runReport()` → `RunResult { cells: CellResult[]; ok: boolean }`, `CellResult { id; type; status: 'success'|'error'|'pass'|'fail'; output?: unknown; error? }`; `formatResult(value)` (crash-proof string). Existing `exportCommand` structure (format guard, `-o`/`--output` via `flagValue`, `writeFileAtomic`, `jsonEnvelope`).
- Produces: `--format json` → `{ ok, cells: [{ id, type, status, output, error }] }` with each `output` run through `formatResult`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let n = 0;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wb-json-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
function fixture(content: string): string {
  const p = join(dir, `wb-${n++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('mtsw export --format json', () => {
  it('emits the executed run report as JSON', async () => {
    const file = fixture(`cells:\n  - data: "6 * 7"\n    id: answer\n`);
    const res = await dispatch(['export', file, '--format', 'json']);
    expect(res.exitCode).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(true);
    const cell = parsed.cells.find((c: { id: string }) => c.id === 'answer');
    expect(cell.status).toBe('success');
    expect(cell.output).toContain('42');
  });
});
```

(Adjust the `.mtsw` fixture to the real shorthand schema — confirm against `workbook/tests/export-tex.test.ts` fixtures.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/export-json.test.ts`
Expected: FAIL — `Unknown format 'json'`.

- [ ] **Step 3: Implement** in `exportCommand`

Change the format guard to allow `json` (and `pdf`, added in Task 7):

```ts
const format = flagValue(args, '--format') ?? 'html';
if (format !== 'html' && format !== 'tex' && format !== 'json' && format !== 'pdf') {
  return fail([`Unknown format '${format}' (supported: html, tex, json, pdf)`]);
}
```

After the `report`/`byId` block, before the html/tex `rendered` assignment, branch for json. Because json needs the full report (not just `byId`), capture the report:

```ts
let report: RunResult | null = null;
if (!args.includes('--no-run')) {
  report = await createExecutor(workbook).runReport();
  const fatal = report.cells.find((r) => r.id === '(workbook)');
  if (fatal) return fail([fatal.error ?? 'workbook run failed']);
  byId = new Map(report.cells.map((r) => [r.id, r]));
}
if (format === 'json') {
  if (!report) return fail(['--format json requires running the notebook (remove --no-run)']);
  const payload = {
    ok: report.ok,
    cells: report.cells.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      output: c.output === undefined ? undefined : formatResult(c.output),
      error: c.error,
    })),
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
  if (outPath) {
    writeFileAtomic(outPath, jsonStr);
    return {
      stdout: jsonEnvelope(
        'export',
        true,
        { path: outPath, bytes: Buffer.byteLength(jsonStr) },
        []
      ),
      stderr: '',
      exitCode: 0,
    };
  }
  return { stdout: jsonStr, stderr: '', exitCode: 0 };
}
```

(Ensure `RunResult` and `formatResult` are imported in cli.ts.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/export-json.test.ts workbook/tests/export.test.ts workbook/tests/export-tex.test.ts`
Expected: new PASS; existing export (html/tex) tests unchanged/green.

- [ ] **Step 5: Gate + commit** (do NOT push — Task 7 finishes workbook)

Run: `cd workbook && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run workbook/ && npm run docs:deps`

```bash
git add workbook/src/cli.ts workbook/tests/export-json.test.ts docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(workbook): mtsw export --format json — executed run report

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
```

---

### Task 7: workbook `toPDF` + `mtsw export --format pdf`

**Files:**

- Create: `workbook/src/pdf.ts`
- Modify: `workbook/src/cli.ts` (`exportCommand`: `--format pdf` path)
- Modify: `workbook/package.json` (bump `@danielsimonjr/mathts-plot` dep to the render-capable version)
- Test: `workbook/tests/export-pdf.test.ts`
- Create: `.changeset/workbook-export-formats.md`

**Interfaces:**

- Consumes: `latexToPdf` from `@danielsimonjr/mathts-plot/render` (Task 4); `toTeX(doc, { parse, fragment })` and `buildRenderDoc(workbook, byId, 'tikz')` and `parse` (already in cli.ts). `RenderDoc`, `PlotRenderError`.
- Produces: `toPDF(doc: RenderDoc, outPath: string, options?: ToPdfOptions): Promise<void>`; CLI `--format pdf` requiring `-o`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../src/cli.js';

let dir: string;
let n = 0;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wb-pdf-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
function fixture(content: string): string {
  const p = join(dir, `wb-${n++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('mtsw export --format pdf', () => {
  it('errors clearly when -o is missing (PDF is binary)', async () => {
    const file = fixture(`cells:\n  - markdown: "# Hi"\n    id: t\n`);
    const res = await dispatch(['export', file, '--format', 'pdf']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/-o|output/i);
  });
  it('surfaces a clear error when no LaTeX engine is available', async () => {
    // If a LaTeX engine IS installed this test is skipped; otherwise assert the message.
    const { latexToPdf } = await import('@danielsimonjr/mathts-plot/render');
    let hasLatex = true;
    try {
      await latexToPdf(
        '\\documentclass{article}\\begin{document}x\\end{document}',
        join(dir, 'probe.pdf')
      );
    } catch {
      hasLatex = false;
    }
    if (hasLatex) return; // real engine present — nothing to assert here
    const file = fixture(`cells:\n  - markdown: "# Hi"\n    id: t\n`);
    const res = await dispatch(['export', file, '--format', 'pdf', '-o', join(dir, 'out.pdf')]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/LaTeX|pdflatex|tectonic/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/export-pdf.test.ts`
Expected: FAIL — `--format pdf` not handled / `pdf.ts` missing.

- [ ] **Step 3: Bump the plot dep + create `workbook/src/pdf.ts`**

In `workbook/package.json`, set `"@danielsimonjr/mathts-plot"` to the render-capable version (the minor bumped in Task 4 — use `"^0.3.0"` once versioned, or workspace protocol if the repo uses it; match how workbook already pins plot). Then:

```ts
/**
 * Render a workbook RenderDoc to a PDF file. Reuses plot's latexToPdf primitive:
 * toTeX(standalone) → LaTeX → PDF. Charts render as native vector TikZ (no
 * rasterization). Async; throws PlotRenderError if no LaTeX engine is available.
 */
import { latexToPdf, type RenderOptions } from '@danielsimonjr/mathts-plot/render';
import { toTeX } from './tex.js';
import type { RenderDoc } from './html.js';

export interface ToPdfOptions extends RenderOptions {
  parse?: (expr: string) => unknown;
}

export function toPDF(doc: RenderDoc, outPath: string, options: ToPdfOptions = {}): Promise<void> {
  const { parse, ...renderOpts } = options;
  return latexToPdf(toTeX(doc, { parse, fragment: false }), outPath, renderOpts);
}
```

- [ ] **Step 4: Wire `--format pdf`** in `exportCommand` (after the json branch)

```ts
if (format === 'pdf') {
  const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
  if (!outPath) return fail(['--format pdf requires an output path: -o <file.pdf>']);
  try {
    await toPDF(buildRenderDoc(workbook, byId, 'tikz'), outPath, { parse });
  } catch (error) {
    return fail([`PDF export failed: ${errMessage(error)}`]);
  }
  return { stdout: jsonEnvelope('export', true, { path: outPath }, []), stderr: '', exitCode: 0 };
}
```

Import `toPDF` from `./pdf.js`. (`errMessage` already used in cli.ts.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx turbo build --filter=@danielsimonjr/mathts-workbook && npx vitest run workbook/tests/export-pdf.test.ts`
Expected: PASS (the `-o`-missing error always; the engine-absent branch asserts the LaTeX message, or is skipped if an engine is present).

- [ ] **Step 6: Gate**

Run: `cd workbook && npx tsc --noEmit && npx eslint . && cd .. && npx vitest run workbook/ && npm run docs:deps`
Expected: full workbook suite green; 0 cycles / 0 new dormant; **no new edge beyond the existing workbook→plot** (workbook already depends on plot).

- [ ] **Step 7: Changeset + CHANGELOG + commit + push**

`.changeset/workbook-export-formats.md`:

```markdown
---
'@danielsimonjr/mathts-workbook': patch
---

Add `toDOT(graph)` + `mtsw graph -f dot`, `mtsw export --format json` (executed run report), and `toPDF` + `mtsw export --format pdf` (reuses plot's latexToPdf; charts render as native TikZ).
```

Add root `CHANGELOG.md` `### Added` entries (workbook: graph -f dot, export --format json, export --format pdf).

```bash
git add workbook/src/pdf.ts workbook/src/cli.ts workbook/package.json workbook/tests/export-pdf.test.ts .changeset/workbook-export-formats.md CHANGELOG.md docs/Architecture/
git commit -m "$(cat <<'EOF'
feat(workbook): toPDF + mtsw export --format pdf (reuses plot latexToPdf)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
EOF
)"
git push origin main
```

Verify L==R.

---

## Post-plan (controller)

After Task 7: final whole-branch review (opus) over `MERGE_BASE..HEAD`; then release — `changeset version` (plot minor→0.3.0, expression minor, workbook internal), build, per-package local-vs-npm pre-flight, `changeset publish` (plot + expression publish; workbook ignored), push `--follow-tags`, verify `npm view` for plot and expression. Update memory.

## Self-Review

**Spec coverage:** (1) plot PNG/PDF bridge → Tasks 3-4 ✓; (2) expression `.toMarkdown` → Task 1 ✓, `.toDOT` → Task 2 ✓; (3) workbook `--format json` → Task 6 ✓; (4) `.toDOT` levels — expression Task 2 + workbook Task 5 ✓; (5) workbook `.toPDF`/`--format pdf` → Task 7 ✓; `graph -f dot` → Task 5 ✓. Never-throw preservation, DGT gate, changesets (expression minor Task 2, plot minor Task 4, workbook patch Task 7) all covered.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Two "confirm against real schema/parser" notes (Task 2 op label, Task 5/6 `.mtsw` fixture shape) are TDD RED-step confirmations of real values, not placeholders.

**Type consistency:** `PlotRenderError`, `RenderOptions`, `renderToFile`, `latexToPdf` defined in Task 3-4 and consumed with matching signatures in Task 7. `RunResult`/`CellResult` fields match `workbook/src/types.ts`. `toDOT(graph)`/`toMarkdown`/`toDOT()` signatures consistent across tasks.
