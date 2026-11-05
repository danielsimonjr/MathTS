/**
 * Scalar Search Example
 *
 * Runs the symbolic-regression walkthrough from docs/reference/scalar-search.md:
 * it fits the planted law x^2 + x from 20 samples on [-1, 1] and prints each
 * Pareto front row's complexity, loss, and canonical key. This is the recorded
 * seed-7 pin (populationSize 8, tournamentSize 4, maxEvaluations 120), so the
 * front is reproducible bit for bit.
 *
 * Run from repo root:
 *   bun --tsconfig-override=tsconfig.base.json examples/scalar-search.ts
 */

import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarGrammar,
} from '@danielsimonjr/mathts-expression';
import { compileScalar, runScalarSearch } from '@danielsimonjr/mathts-functions';

async function main() {
  console.log('=== MathTS Scalar Search ===\n');

  const b = createScalarBuilder();
  const law = b.op('+', [b.op('*', [b.symbol('x'), b.symbol('x')]), b.symbol('x')]);
  const xs = new Float64Array(20);
  for (let i = 0; i < 20; i += 1) xs[i] = -1 + (2 * i) / 19;

  const problem = {
    variables: ['x'],
    columns: { x: xs },
    observed: compileScalar(law, { variables: ['x'] }).evaluate([xs]).values,
  };

  const grammar: ScalarGrammar = {
    variables: ['x'],
    binary: ['+', '*', '^'],
    unary: [],
    literals: [1],
    maxSize: 7,
  };

  console.log('Searching for the law behind y = x^2 + x (seed 7, 120 evaluations)...\n');
  const result = await runScalarSearch(problem, {
    grammar,
    seed: 7,
    populationSize: 8,
    tournamentSize: 4,
    maxEvaluations: 120,
  });

  console.log(`stopReason: ${result.stopReason} after ${result.evaluations} evaluations\n`);
  console.log('complexity  loss                  scalarCanonicalKey');
  for (const row of result.front) {
    console.log(`${row.complexity}\t${row.loss}\t${scalarCanonicalKey(row.item)}`);
  }

  console.log(
    `\nseed: ${result.seed} — the same seed, problem, and options reproduce this front bit for bit.`
  );
}

await main();
