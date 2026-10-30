import { describe, expect, it } from 'vitest';
import { scalar } from '../src/scalar-eval.js';
import { frontToJson, frontToLatexTable } from '../src/front-export.js';
import { scoreFront } from '../src/pareto-front.js';
import type { ScoredCandidate } from '../src/pareto-front.js';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';

const a = scalar.symbol('a');
const b = scalar.symbol('b');
const x = scalar.symbol('x');

/** Hand score: -ln(0.25/0.5)/(3-1) = ln(2)/2 */
const ROW2_SCORE = Math.log(2) / 2;

const FIXTURE: ScoredCandidate<ScalarNode>[] = [
  { complexity: 1, loss: 0.5, score: 0, item: x },
  { complexity: 3, loss: 0.25, score: ROW2_SCORE, item: scalar.op('+', [a, b]) },
  { complexity: 3, loss: 0.125, score: null, item: scalar.op('*', [a, b]) },
];

const EXPECTED_LATEX = [
  '\\begin{tabular}{cccc}',
  'complexity & loss & score & equation \\\\',
  '1 & 0.500000 & 0.00000 &  x \\\\',
  '3 & 0.250000 & 0.346574 &  a+ b \\\\',
  '3 & 0.125000 &  &  a\\cdot b \\\\',
  '\\end{tabular}',
].join('\n');

const EXPECTED_JSON = {
  schemaVersion: 1 as const,
  rows: [
    {
      complexity: 1,
      loss: 0.5,
      score: 0,
      key: '{"k":"s","v":"x"}',
      tex: ' x',
    },
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

describe('front-export M15', () => {
  it('frontToLatexTable matches pinned tabular literal', () => {
    expect(frontToLatexTable(FIXTURE)).toBe(EXPECTED_LATEX);
  });

  it('frontToJson matches pinned schema and keys', () => {
    const doc = frontToJson(FIXTURE);
    expect(doc).toEqual(EXPECTED_JSON);
    const round = JSON.parse(JSON.stringify(doc)) as typeof doc;
    expect(round.rows.map((r) => r.key)).toEqual(EXPECTED_JSON.rows.map((r) => r.key));
    expect(round.rows.map((r) => r.tex)).toEqual(EXPECTED_JSON.rows.map((r) => r.tex));
  });

  it('null score row matches scoreFront linear scale', () => {
    const linear = scoreFront([{ complexity: 3, loss: 0.125, item: scalar.op('*', [a, b]) }], {
      lossScale: 'linear',
    });
    expect(linear[0]!.score).toBe(null);
  });

  it('exports from barrel', async () => {
    const barrel = await import('../src/index.js');
    expect(barrel.frontToLatexTable).toBeTypeOf('function');
    expect(barrel.frontToJson).toBeTypeOf('function');
  });
});
