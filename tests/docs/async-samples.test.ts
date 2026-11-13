import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractFences } from '../../tools/test/readme-fences.mjs';
import {
  declaredReturns,
  deriveAsyncExports,
  markdownFiles,
  unawaitedCalls,
} from '../../tools/test/async-exports.mjs';

const repoRoot = join(import.meta.dirname, '../..');

/**
 * #900: a sample that calls an export which returns a Promise must `await` it.
 *
 * The list of such exports comes from the built packages (`deriveAsyncExports`), so a new
 * Promise-returning export is covered without an edit here. The scan reads every Markdown file of
 * the repository. It needs the built `dist` of the packages: `bun run build` first.
 */

/** A name list that a build cannot lose: if the derivation stops finding these, it is broken. */
const CANARY_ASYNC = ['shapiroWilkTest', 'chiSquareTest', 'pageRank', 'parallelSum', 'loadWasm'];
/** Exports that are synchronous, or synchronous for some arguments: never in the list. */
const CANARY_SYNC = ['welchPSD', 'stft', 'fft', 'parallelFFT', 'casSimplify'];

let asyncNames: ReadonlySet<string> = new Set();
beforeAll(async () => {
  asyncNames = await deriveAsyncExports(repoRoot);
}, 120_000);

describe('#900 — the Promise-returning exports are read from the built packages', () => {
  it('finds the known Promise-returning exports and leaves the synchronous ones out', () => {
    for (const name of CANARY_ASYNC) expect(asyncNames.has(name), name).toBe(true);
    for (const name of CANARY_SYNC) expect(asyncNames.has(name), name).toBe(false);
    expect(asyncNames.size).toBeGreaterThan(50);
  });

  it('reads declarations from an emitted .d.ts', () => {
    const dts = `
/** Example: export declare function inComment(x: number): Promise<number>; */
export declare function plain(x: number): number;
export declare function wait<T extends { a: (b: number) => void }>(
  x: T,
  cb: (y: number) => Promise<void>
): Promise<Map<string, number[]>>;
export declare function mixed(x: string): string;
export declare function mixed(x: string[]): Promise<string[]>;
export declare const arrow: (x: number) => Promise<void>;
export declare const syncArrow: (x: number) => number;
export declare const typed: TypedFunction;
`;
    const found = declaredReturns(dts);
    expect(found.get('plain')).toEqual([false]);
    expect(found.get('wait')).toEqual([true]);
    expect(found.get('mixed')).toEqual([false, true]);
    expect(found.get('arrow')).toEqual([true]);
    expect(found.get('syncArrow')).toEqual([false]);
    expect(found.has('typed')).toBe(false);
    expect(found.has('inComment')).toBe(false);
  });
});

const fence = (code: string, lang = 'ts'): string => '```' + lang + ' example\n' + code + '\n```\n';
const flagged = (code: string, lang = 'ts'): string[] =>
  unawaitedCalls(fence(code, lang), asyncNames);

describe('#900 — the scanner reports an unawaited call to an async export', () => {
  it('reports a plain call', () => {
    expect(flagged('const r = shapiroWilkTest(x);')).toHaveLength(1);
    expect(flagged('pageRank(g);')).toHaveLength(1);
  });

  it('reports a namespace call, `ns.fn(x)`', () => {
    expect(flagged('const r = stats.shapiroWilkTest(x);')).toHaveLength(1);
    expect(
      flagged("import * as m from '@danielsimonjr/mathts-functions';\nm.pageRank(g);")
    ).toHaveLength(1);
  });

  it('reports the call that has no await when another call on the same line has one', () => {
    expect(flagged('const a = await chiSquareTest(x); const b = mannWhitneyTest(y);')).toHaveLength(
      1
    );
    expect(flagged('const p = pageRank(g); console.log(await q);')).toHaveLength(1);
  });

  it('reports a call through an import alias', () => {
    const code = "import { pageRank as pr } from '@danielsimonjr/mathts-functions';\npr(g);";
    expect(flagged(code)).toHaveLength(1);
  });

  it('reports a call whose await is on another statement or is a void', () => {
    expect(flagged('await foo();\nconst r =\n  shapiroWilkTest(x);')).toHaveLength(1);
    expect(flagged('void pageRank(g);')).toHaveLength(1);
    expect(flagged('const { statistic } = shapiroWilkTest(x);')).toHaveLength(1);
  });

  it('reports a name in the parallel family that the old hand list lacked', () => {
    expect(flagged('const total = parallelSum(data);')).toHaveLength(1);
  });
});

describe('#900 — the scanner accepts a call that is awaited, returned or chained', () => {
  it.each([
    'const r = await shapiroWilkTest(x);',
    'const r = await stats.shapiroWilkTest(x);',
    'const r = (await pageRank(g)).scores;',
    'const r = await (pageRank(g));',
    'async function f() { return pageRank(g); }',
    'const f = async () => pageRank(g);',
    'const [a, b] = await Promise.all([pageRank(g), shapiroWilkTest(x)]);',
    'const done = await Promise.allSettled([pageRank(g)]);',
    'pageRank(g).then((r) => console.log(r));',
    'pageRank(g).catch(console.error);',
    'const p = pageRank(g);\nconsole.log(await p);',
    'const p = pageRank(g);\np.then(console.log);',
    'const p = pageRank(g);\nconst q = shapiroWilkTest(x);\nawait Promise.all([p, q]);',
  ])('%s', (code) => {
    expect(flagged(code)).toEqual([]);
  });

  it('ignores a name in a comment, a string or a template', () => {
    expect(
      flagged('// pageRank(g) is async\nconst s = "pageRank(g)";\nconst t = `pageRank(g)`;')
    ).toEqual([]);
    expect(flagged('/* shapiroWilkTest(x) */')).toEqual([]);
  });

  it('ignores a function that the sample defines or imports from another package', () => {
    expect(flagged('async function parallelSum(data) { return 0; }\nparallelSum(data);')).toEqual(
      []
    );
    expect(flagged("import { pageRank } from 'graphology-metrics';\npageRank(g);")).toEqual([]);
    expect(flagged('const pageRank = (g) => 1;\npageRank(g);')).toEqual([]);
  });

  it('ignores a method of another object that shares the name, and prose fences', () => {
    expect(flagged('this.pageRank(g);')).toEqual([]);
    expect(flagged('obj.make().pageRank(g);')).toEqual([]);
    expect(flagged('pageRank(g)', 'text')).toEqual([]);
  });
});

describe('#900 — every Markdown file of the repository awaits what it calls', () => {
  const files = markdownFiles(repoRoot);

  it('scans the whole tree', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('has no unawaited call to an async export in any fenced sample', () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const hit of unawaitedCalls(readFileSync(file, 'utf8'), asyncNames)) {
        problems.push(`${relative(repoRoot, file)}: ${hit}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('statistics/README.md shows the awaited form of a Promise-returning test', () => {
    const markdown = readFileSync(join(repoRoot, 'statistics/README.md'), 'utf8');
    const awaited = extractFences(markdown).some((f) => /await\s+shapiroWilkTest\(/.test(f.code));
    expect(awaited).toBe(true);
  });
});
