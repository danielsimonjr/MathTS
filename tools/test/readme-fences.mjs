/**
 * README fence runner for the packed-consumer checks.
 *
 * A code fence of a published README carries a runtime tag after its language:
 *
 *     ```ts node       runs in the tarball consumer on Node (and is type-checked)
 *     ```ts browser    type-checked with the DOM lib only; never run
 *     ```ts example    an illustration that has no setup; skipped, but the tag is required
 *
 * GitHub and npm read only the first word of the info string, so the tag does not change how
 * a README renders. A `ts`, `typescript`, `js`, `javascript`, `mjs` or `tsx` fence without a tag
 * is a finding: a newcomer who runs every fence cannot tell which ones need a browser or a
 * bundler (dogfood #914, #916).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Languages whose fences must carry a runtime tag. */
const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript', 'mjs', 'tsx']);

/** Runtime tags. */
export const FENCE_TAGS = new Set(['node', 'browser', 'example']);

/**
 * Extract the fenced code blocks of a Markdown document.
 * @param {string} markdown
 * @returns {{ lang: string, tag: string | null, code: string, line: number }[]}
 */
export function extractFences(markdown) {
  const fences = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\S*)\s*(\S*)\s*$/.exec(lines[i]);
    if (!open) continue;
    const start = i + 1;
    const body = [];
    for (i = start; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
    fences.push({ lang: open[1].toLowerCase(), tag: open[2] ? open[2].toLowerCase() : null, code: body.join('\n'), line: start });
  }
  return fences;
}

/**
 * Check the READMEs of the installed packages: tags, a Node run of every `node` fence, and a
 * type check of every `node` and `browser` fence.
 * @param {string} consumer consumer folder with esbuild, typescript and @types/node installed
 * @param {string[]} packageNames installed package names whose README to check
 * @returns {{ problems: string[], counts: { node: number, browser: number, example: number } }}
 */
export function fenceProblems(consumer, packageNames) {
  const problems = [];
  const counts = { node: 0, browser: 0, example: 0 };
  const dir = join(consumer, 'fences');
  mkdirSync(dir, { recursive: true });
  const typed = [];
  for (const name of packageNames) {
    const readme = join(consumer, 'node_modules', name, 'README.md');
    if (!existsSync(readme)) continue;
    for (const fence of extractFences(readFileSync(readme, 'utf8'))) {
      if (!CODE_LANGS.has(fence.lang)) continue;
      const where = `${name} README line ${fence.line}`;
      if (fence.tag === null || !FENCE_TAGS.has(fence.tag)) {
        problems.push(`${where}: ${fence.lang} fence needs a runtime tag (node, browser or example)`);
        continue;
      }
      counts[fence.tag]++;
      if (fence.tag === 'example') continue;
      const base = `${name.replace(/[^\w]/g, '_')}_${fence.line}`;
      const file = join(dir, `${base}.mts`);
      writeFileSync(file, fence.code.endsWith('\n') ? fence.code : `${fence.code}\n`);
      typed.push({ base, file, where, tag: fence.tag });
    }
  }
  if (typed.length === 0) return { problems, counts };

  // 1. Type check every runnable fence (DOM lib for all; browser fences may use `document`).
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: ['node'],
        noUnusedLocals: false,
        resolveJsonModule: true,
      },
      files: typed.map((t) => `${t.base}.mts`),
    })
  );
  let out = '';
  try {
    out = execFileSync('npx', ['--no-install', 'tsc', '-p', dir], { cwd: consumer, encoding: 'utf8', shell: process.platform === 'win32' });
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/error TS\d+/.test(out)) throw err;
  }
  for (const d of out.split(/\r?\n(?=\S)/).filter((x) => /error TS\d+/.test(x))) {
    const m = /(?:^|[\\/])([\w@.-]+)\.mts\((\d+),/.exec(d);
    const hit = m && typed.find((t) => t.base === m[1]);
    problems.push(`${hit?.where ?? 'fence'} does not type-check: ${d.split(/\r?\n/)[0].replace(/^.*?\): /, '')}`);
  }

  // 2. Run every node fence: transpile with esbuild, run with node.
  const driver = join(dir, 'run.mjs');
  writeFileSync(
    driver,
    [
      'import { transformSync } from "esbuild";',
      'import { readFileSync, writeFileSync } from "node:fs";',
      'const [src, dest] = process.argv.slice(2);',
      'writeFileSync(dest, transformSync(readFileSync(src, "utf8"), { loader: "ts", format: "esm", target: "esnext" }).code);',
    ].join('\n')
  );
  for (const t of typed.filter((x) => x.tag === 'node')) {
    const js = join(dir, `${t.base}.run.mjs`);
    try {
      execFileSync(process.execPath, [driver, t.file, js], { cwd: consumer, stdio: 'pipe' });
      // A fence that opens worker threads may leave the process alive; the fence must end it.
      execFileSync(process.execPath, [js], { cwd: consumer, stdio: 'pipe', timeout: 90_000 });
    } catch (err) {
      const msg = `${err.stderr ?? ''}`.split(/\r?\n/).filter((l) => /Error|error/.test(l))[0] ?? String(err.message);
      problems.push(`${t.where} throws on Node: ${msg.trim().slice(0, 240)}`);
    }
  }
  return { problems, counts };
}
