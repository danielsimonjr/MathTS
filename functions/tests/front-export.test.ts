import { describe, expect, it } from 'vitest';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { frontToJson, frontToLatexTable } from '../src/front-export.js';
import type { FrontJson } from '../src/front-export.js';
import { paretoFront, scoreFront } from '../src/pareto-front.js';
import type { ScoredCandidate } from '../src/pareto-front.js';
import { scalarToTex } from '../src/factories/index.js';
import { scalar } from '../src/scalar-eval.js';

const a = scalar.symbol('a');
const b = scalar.symbol('b');
const x = scalar.symbol('x');

/** Hand score: -ln(0.25 / 0.5) / (3 - 1) = ln(2) / 2 = 0.34657359... */
const ROW2_SCORE = Math.log(2) / 2;

const FIXTURE: ScoredCandidate<ScalarNode>[] = [
  { complexity: 1, loss: 0.5, score: 0, item: x },
  { complexity: 3, loss: 0.25, score: ROW2_SCORE, item: scalar.op('+', [a, b]) },
  { complexity: 3, loss: 0.125, score: null, item: scalar.op('*', [a, b]) },
];

// Formula cells are the strings pinned in scalar-node-bridge.test.ts (` x`, ` a+ b`, ` a\cdot b`),
// each in math mode because a `tabular` cell is text mode.
const EXPECTED_LATEX = String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
1 & 0.500000 & 0.00000 & $ x$ \\
3 & 0.250000 & 0.346574 & $ a+ b$ \\
3 & 0.125000 &  & $ a\cdot b$ \\
\end{tabular}`;

const EXPECTED_JSON: FrontJson = {
  schemaVersion: 1,
  rows: [
    { complexity: 1, loss: 0.5, score: 0, key: '{"k":"s","v":"x"}', tex: ' x' },
    {
      complexity: 3,
      loss: 0.25,
      score: ROW2_SCORE,
      key: '{"k":"+","a":[{"k":"s","v":"a"},{"k":"s","v":"b"}]}',
      tex: ' a+ b',
    },
    {
      complexity: 3,
      loss: 0.125,
      score: null,
      key: '{"k":"*","a":[{"k":"s","v":"a"},{"k":"s","v":"b"}]}',
      tex: ' a\\cdot b',
    },
  ],
};

/** A front that the search would report: built with `paretoFront` and `scoreFront`, not by hand. */
function searchedFront(lossScale?: 'log' | 'linear'): ScoredCandidate<ScalarNode>[] {
  const front = paretoFront([
    { loss: 0.5, complexity: 1, item: x },
    { loss: 0.25, complexity: 3, item: scalar.op('+', [a, b]) },
    { loss: 0.125, complexity: 5, item: scalar.op('*', [a, b]) },
  ]);
  return scoreFront(front, lossScale === undefined ? undefined : { lossScale });
}

describe('frontToLatexTable', () => {
  it('matches the hand-written tabular for a three-row front', () => {
    expect(frontToLatexTable(FIXTURE)).toBe(EXPECTED_LATEX);
  });

  it('renders a front built by paretoFront and scoreFront', () => {
    expect(frontToLatexTable(searchedFront())).toBe(
      String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
1 & 0.500000 & 0.00000 & $ x$ \\
3 & 0.250000 & 0.346574 & $ a+ b$ \\
5 & 0.125000 & 0.346574 & $ a\cdot b$ \\
\end{tabular}`
    );
  });

  it('leaves the score cell empty on the linear loss scale, where scoreFront stores null', () => {
    const linear = searchedFront('linear');
    expect(linear.map((row) => row.score)).toEqual([null, null, null]);
    expect(frontToLatexTable(linear)).toBe(
      String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
1 & 0.500000 &  & $ x$ \\
3 & 0.250000 &  & $ a+ b$ \\
5 & 0.125000 &  & $ a\cdot b$ \\
\end{tabular}`
    );
  });

  it('writes the infinity symbol in math mode, and NaN as text', () => {
    const rows: ScoredCandidate<ScalarNode>[] = [
      { complexity: 1, loss: 0.5, score: Infinity, item: x },
      { complexity: 2, loss: 0.25, score: -Infinity, item: x },
      { complexity: 3, loss: 0, score: Number.NaN, item: x },
    ];
    expect(frontToLatexTable(rows)).toBe(
      String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
1 & 0.500000 & $\infty$ & $ x$ \\
2 & 0.250000 & $-\infty$ & $ x$ \\
3 & 0.00000 & NaN & $ x$ \\
\end{tabular}`
    );
  });

  it('scores an exact fit as an infinite score through scoreFront', () => {
    const exact = scoreFront(
      paretoFront([
        { loss: 0.5, complexity: 1, item: x },
        { loss: 0, complexity: 2, item: scalar.op('*', [x, x]) },
      ])
    );
    expect(exact[1]!.score).toBe(Infinity);
    expect(frontToLatexTable(exact).split('\n')[3]).toBe(
      String.raw`2 & 0.00000 & $\infty$ & $ x\cdot x$ \\`
    );
  });

  it('formats loss and score with options.precision', () => {
    expect(frontToLatexTable(FIXTURE, { precision: 3 })).toBe(
      String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
1 & 0.500 & 0.00 & $ x$ \\
3 & 0.250 & 0.347 & $ a+ b$ \\
3 & 0.125 &  & $ a\cdot b$ \\
\end{tabular}`
    );
    expect(frontToLatexTable(FIXTURE, { precision: 1 }).split('\n')[3]).toBe(
      String.raw`3 & 0.3 & 0.3 & $ a+ b$ \\`
    );
  });

  it('prints a loss far from 1 in toPrecision exponent form, which is text-mode safe', () => {
    const tiny: ScoredCandidate<ScalarNode>[] = [{ complexity: 1, loss: 3e-16, score: 0, item: x }];
    expect(frontToLatexTable(tiny).split('\n')[2]).toBe(
      String.raw`1 & 3.00000e-16 & 0.00000 & $ x$ \\`
    );
  });

  it('keeps every LaTeX command inside math mode', () => {
    const rows = frontToLatexTable([
      ...FIXTURE,
      { complexity: 4, loss: 0.1, score: Infinity, item: scalar.call('sin', x) },
      { complexity: 5, loss: 0.1, score: -Infinity, item: scalar.op('/', [a, b]) },
    ]).split('\n');
    expect(rows[0]).toBe('\\begin{tabular}{cccc}');
    expect(rows.at(-1)).toBe('\\end{tabular}');
    for (const row of rows.slice(1, -1)) {
      const textMode = row.replaceAll(/\$[^$]*\$/g, '').replace(/ \\\\$/, '');
      expect(textMode, row).not.toContain('\\');
      expect(row.split('$').length % 2, row).toBe(1);
    }
  });

  it('uses scalarToTex for each equation and keeps the other columns in order', () => {
    const lines = frontToLatexTable(FIXTURE).split('\n');
    FIXTURE.forEach((row, index) => {
      const cells = lines[index + 2]!.replace(/ \\\\$/, '').split(' & ');
      expect(cells).toHaveLength(4);
      expect(cells[0]).toBe(String(row.complexity));
      expect(cells[3]).toBe(`$${scalarToTex(row.item)}$`);
    });
  });

  it('writes only the header for an empty front', () => {
    expect(frontToLatexTable([])).toBe(
      String.raw`\begin{tabular}{cccc}
complexity & loss & score & equation \\
\end{tabular}`
    );
  });

  it('does not change its input', () => {
    const frozen = FIXTURE.map((row) => Object.freeze({ ...row }));
    Object.freeze(frozen);
    expect(frontToLatexTable(frozen)).toBe(EXPECTED_LATEX);
    expect(frontToLatexTable(frozen)).toBe(EXPECTED_LATEX);
  });

  it.each([0, 101, 2.5, Number.NaN, Infinity, -1])('rejects precision %s', (precision) => {
    expect(() => frontToLatexTable(FIXTURE, { precision })).toThrow(RangeError);
    expect(() => frontToLatexTable(FIXTURE, { precision })).toThrow(/precision must be an integer/);
  });

  it('accepts the precision bounds 1 and 100', () => {
    expect(() => frontToLatexTable(FIXTURE, { precision: 1 })).not.toThrow();
    expect(() => frontToLatexTable(FIXTURE, { precision: 100 })).not.toThrow();
  });

  it.each([Number.NaN, Infinity, -Infinity])('rejects complexity %s', (complexity) => {
    const rows: ScoredCandidate<ScalarNode>[] = [{ complexity, loss: 0.5, score: 0, item: x }];
    expect(() => frontToLatexTable(rows)).toThrow(/row 0 has complexity .*finite/);
  });
});

describe('frontToJson', () => {
  it('matches the pinned schema, canonical keys and tex', () => {
    expect(frontToJson(FIXTURE)).toEqual(EXPECTED_JSON);
  });

  it('keys the symbol x as {"k":"s","v":"x"}', () => {
    expect(frontToJson(FIXTURE).rows[0]!.key).toBe('{"k":"s","v":"x"}');
  });

  it('restores identical keys, tex and numbers after JSON.stringify and JSON.parse', () => {
    const report = frontToJson(FIXTURE);
    const round = JSON.parse(JSON.stringify(report)) as FrontJson;
    expect(round).toEqual(report);
    expect(round.rows.map((row) => row.key)).toEqual(EXPECTED_JSON.rows.map((row) => row.key));
    expect(round.rows.map((row) => row.tex)).toEqual(EXPECTED_JSON.rows.map((row) => row.tex));
  });

  it('does not turn an infinite score into the linear-scale null', () => {
    const rows: ScoredCandidate<ScalarNode>[] = [
      { complexity: 1, loss: 0.5, score: 0, item: x },
      { complexity: 2, loss: 0, score: Infinity, item: x },
      { complexity: 3, loss: Number.NaN, score: -Infinity, item: x },
      { complexity: 4, loss: Infinity, score: Number.NaN, item: x },
      { complexity: 5, loss: 0.1, score: null, item: x },
    ];
    const report = frontToJson(rows);
    expect(report.rows.map((row) => row.score)).toEqual([0, 'Infinity', '-Infinity', 'NaN', null]);
    expect(report.rows.map((row) => row.loss)).toEqual([0.5, 0, 'NaN', 'Infinity', 0.1]);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(JSON.stringify(report).match(/null/g)).toHaveLength(1);
  });

  it('reports an exact fit from scoreFront as an infinite score, not null', () => {
    const exact = scoreFront(
      paretoFront([
        { loss: 0.5, complexity: 1, item: x },
        { loss: 0, complexity: 2, item: scalar.op('*', [x, x]) },
      ])
    );
    expect(frontToJson(exact).rows[1]!.score).toBe('Infinity');
  });

  it('writes a null score for the linear scale', () => {
    expect(frontToJson(searchedFront('linear')).rows.map((row) => row.score)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('gives commuted trees one key and two tex strings', () => {
    const rows: ScoredCandidate<ScalarNode>[] = [
      { complexity: 3, loss: 0.5, score: 0, item: scalar.op('+', [a, b]) },
      { complexity: 3, loss: 0.5, score: 0, item: scalar.op('+', [b, a]) },
    ];
    const [first, second] = frontToJson(rows).rows;
    expect(first!.key).toBe(second!.key);
    expect(first!.tex).toBe(' a+ b');
    expect(second!.tex).toBe(' b+ a');
  });

  it('is {schemaVersion: 1, rows: []} for an empty front', () => {
    expect(frontToJson([])).toEqual({ schemaVersion: 1, rows: [] });
  });

  it('does not change its input', () => {
    const frozen = FIXTURE.map((row) => Object.freeze({ ...row }));
    Object.freeze(frozen);
    expect(frontToJson(frozen)).toEqual(EXPECTED_JSON);
  });

  it('rejects a complexity that is not finite', () => {
    const rows: ScoredCandidate<ScalarNode>[] = [
      { complexity: Number.NaN, loss: 0.5, score: 0, item: x },
    ];
    expect(() => frontToJson(rows)).toThrow(/frontToJson: row 0 has complexity NaN/);
  });
});

describe('front export barrel', () => {
  it('exports both writers from the package barrel', async () => {
    const barrel = await import('../src/index.js');
    expect(barrel.frontToLatexTable).toBe(frontToLatexTable);
    expect(barrel.frontToJson).toBe(frontToJson);
  });
});
