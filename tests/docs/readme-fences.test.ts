import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
// The one fence parser of the repository: it reads the runtime tag after the language
// (```` ```ts node ````), which a bare language pattern does not match.
import { extractFences } from '../../tools/test/readme-fences.mjs';

const repoRoot = join(import.meta.dirname, '../..');

/** README paths whose fenced TypeScript samples must compile. */
const README_PATHS = [
  'README.md',
  'core/README.md',
  'compat/README.md',
  'linalg/README.md',
  'arithmetic/README.md',
  'trigonometry/README.md',
  'statistics/README.md',
  'signal/README.md',
  'numbers/README.md',
  'ast/README.md',
  'tensor/README.md',
  'autograd/README.md',
  'parallel/README.md',
  'packages/workerpool/README.md',
  'gpu/README.md',
  'plot/README.md',
] as const;

const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript']);

function wrapForTranspile(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return trimmed;
  const importPattern = /^(\s*import[\s\S]*?;[\r\n]*)+/;
  const importMatch = trimmed.match(importPattern);
  const imports = importMatch?.[0] ?? '';
  const body = importMatch ? trimmed.slice(importMatch[0].length).trim() : trimmed;
  const hasTopLevelAwait = /^\s*await\b/m.test(body);
  const wrappedInAsync = /\basync\s+function\b/.test(body) || /\basync\s*\(/.test(body);
  if (hasTopLevelAwait && !wrappedInAsync) {
    return `${imports}\nawait (async () => {\n${body}\n})();\n`;
  }
  return trimmed;
}

function compileFence(code: string, virtualName: string): string[] {
  const source = wrapForTranspile(code);
  try {
    transformSync(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
      sourcefile: virtualName,
      logLevel: 'silent',
    });
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${virtualName}: ${message}`];
  }
}

function extractBlocks(markdown: string): string[] {
  return extractFences(markdown)
    .filter((fence) => CODE_LANGS.has(fence.lang))
    .map((fence) => fence.code);
}

describe('README fenced code compiles', () => {
  for (const rel of README_PATHS) {
    it(rel, () => {
      const markdown = readFileSync(join(repoRoot, rel), 'utf8');
      const blocks = extractBlocks(markdown);
      expect(blocks.length, `${rel}: expected at least one ts/js fenced sample`).toBeGreaterThan(0);

      const failures: string[] = [];
      blocks.forEach((block, index) => {
        const virtual = `${rel}#block-${index + 1}.ts`;
        const errors = compileFence(block, virtual);
        failures.push(...errors);
      });
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
