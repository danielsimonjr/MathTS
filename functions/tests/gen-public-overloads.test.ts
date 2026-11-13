/**
 * `scripts/gen-public-overloads.mjs`: the type aliases it reads, the per-export `sigTypes`
 * override, the `fallback` lines, and the public overloads that the committed manifest writes
 * for the typed-return contract (median, mode, mad, parallelFFT).
 *
 * The first group runs the real script on a fixture folder (`--root`), so it needs no change
 * of the repository files.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const FUNCTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(FUNCTIONS_DIR, 'scripts/gen-public-overloads.mjs');
const GENERATED = join(FUNCTIONS_DIR, 'types/public-overloads.generated.d.ts');

/** Files that the script reads from every root, to check that the public option types agree. */
const OPTION_FILES = [
  'src/statistics/numeric-data.ts',
  'types/stat-reduce-options.d.ts',
  'src/factories/evaluate.ts',
  'types/physics-evaluate-options.d.ts',
];

let scratch = '';
let counter = 0;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'gen-overloads-'));
});

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

type Run = { out: string; error: string };

/** Run the generator on a fixture root with one source file and a manifest. */
function generate(source: string, entry: Record<string, unknown>): Run {
  const root = join(scratch, `root-${counter++}`);
  mkdirSync(join(root, 'src/typed'), { recursive: true });
  mkdirSync(join(root, 'src/statistics'), { recursive: true });
  mkdirSync(join(root, 'src/factories'), { recursive: true });
  mkdirSync(join(root, 'types'), { recursive: true });
  for (const file of OPTION_FILES) copyFileSync(join(FUNCTIONS_DIR, file), join(root, file));
  writeFileSync(join(root, 'src/typed/fixture.ts'), source);
  writeFileSync(
    join(root, 'types/public-overloads.manifest.json'),
    JSON.stringify({ exports: [{ source: 'src/typed/fixture.ts', ...entry }] })
  );
  try {
    execFileSync(process.execPath, [SCRIPT, `--root=${root}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return { out: '', error: String((error as { stderr?: unknown }).stderr ?? error) };
  }
  return {
    out: readFileSync(join(root, 'types/public-overloads.generated.d.ts'), 'utf8'),
    error: '',
  };
}

describe('gen-public-overloads: type aliases', () => {
  const SOURCE = [
    'type Poly = number[]; // ascending powers; a note with a semicolon',
    'type Pair = [number, string]; // a tuple',
    'type Box = { a: number; b: string };',
    "export const f = mathTyped('f', {",
    '  number: (x: number): Poly => [x],',
    '  string: (x: string): Pair => [1, x],',
    "  Float64Array: (x: Float64Array): Box => ({ a: x.length, b: 'x' }),",
    '});',
    '',
  ].join('\n');

  it('reads an alias value up to its own `;`, with or without a trailing comment', () => {
    const { out, error } = generate(SOURCE, { name: 'f' });
    expect(error).toBe('');
    expect(out).toContain('  (a: number): number[];');
    expect(out).toContain('  (a: string): [number, string];');
    expect(out).toContain('  (a: Float64Array): { a: number; b: string };');
  });
});

describe('gen-public-overloads: sigTypes override', () => {
  const SOURCE = [
    "export const g = mathTyped('g', {",
    '  Array: (xs: number[]): number => xs.length,',
    "  'Array | Matrix, number': (xs: number[], n: number): number => n,",
    "  '...': (args: unknown[]): unknown => args,",
    '});',
    '',
  ].join('\n');

  it('keeps the shared mapping when the export has no override', () => {
    const { out, error } = generate(SOURCE, { name: 'g' });
    expect(error).toBe('');
    expect(out).toContain('  (a: number[] | number[][]): number;');
    expect(out).toContain('  (a: number[] | Matrix, b: number): number;');
  });

  it('replaces the type of a name for that export only', () => {
    const { out, error } = generate(SOURCE, {
      name: 'g',
      sigTypes: { Array: 'number[]', 'Array | Matrix': 'number[] | number[][] | Matrix' },
    });
    expect(error).toBe('');
    expect(out).toContain('  (a: number[]): number;');
    expect(out).not.toContain('(a: number[] | number[][]): number;');
    expect(out).toContain('  (a: number[] | number[][] | Matrix, b: number): number;');
  });

  it('writes the manifest fallback lines after the specific overloads', () => {
    const { out, error } = generate(SOURCE, {
      name: 'g',
      fallback: ['(...rest: number[]): number;', '(...rest: unknown[]): unknown;'],
    });
    expect(error).toBe('');
    const block = out.slice(out.indexOf('export interface GCallable'), out.indexOf('PublicG'));
    const lines = block.split('\n').map((line) => line.trim());
    expect(lines.indexOf('(...rest: number[]): number;')).toBeGreaterThan(
      lines.indexOf('(a: number[] | Matrix, b: number): number;')
    );
    expect(lines.indexOf('(...rest: unknown[]): unknown;')).toBeGreaterThan(
      lines.indexOf('(...rest: number[]): number;')
    );
  });

  it('fails when an override name matches no signature part', () => {
    const { out, error } = generate(SOURCE, { name: 'g', sigTypes: { Float32Array: 'number[]' } });
    expect(out).toBe('');
    expect(error).toContain('g: sigTypes "Float32Array" matches no signature part');
  });
});

describe('gen-public-overloads: the typed-return contract in the committed file', () => {
  const text = readFileSync(GENERATED, 'utf8');
  const interfaceOf = (name: string): string => {
    const start = text.indexOf(`export interface ${name} {`);
    expect(start, `${name} is declared`).toBeGreaterThanOrEqual(0);
    return text.slice(start, text.indexOf('\n}\n', start));
  };

  it('parallelFFT takes a vector: no 2-D overload', () => {
    const block = interfaceOf('ParallelFFTCallable');
    expect(block).toContain('(a: readonly number[]): {');
    expect(block).toContain('(a: Float64Array): Promise<{');
    expect(block).not.toContain('number[][]');
  });

  it.each(['MedianCallable', 'ModeCallable', 'MadCallable'])(
    '%s takes a vector, a 2-D array and a Matrix',
    (name) => {
      expect(interfaceOf(name)).toContain('(a: number[] | number[][] | Matrix)');
    }
  );

  it('the dimension form returns one number per slice for a 2-D input', () => {
    expect(interfaceOf('MedianCallable')).toContain(
      '(a: number[] | number[][] | Matrix, b: number | BigNumber): number | number[];'
    );
  });
});
