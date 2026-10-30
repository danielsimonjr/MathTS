/**
 * Fits for the P6-4 pins on the L1 and Huber BFGS gradient. The goldens in
 * `fit-scalar-robust-loss-extended-golden.json` were produced by the pre-P6-4 `fitScalarParameters`
 * (`gradL1` / `gradHuber`, commit 0ec71dc0). The models use only `+`, `*` and `sqrt`, which are
 * correctly rounded, so the numbers do not depend on the engine's `Math.pow`/`exp`/`log`.
 */
import { scalar } from '../../src/index.js';
import type { FitScalarOptions } from '../../src/fit-scalar.js';

type Node = ReturnType<typeof scalar.symbol>;

export interface RobustCase {
  name: string;
  node: () => Node;
  columns: number[][];
  y: number[];
  variables: string[];
  options: Omit<FitScalarOptions, 'loss' | 'algorithm' | 'restarts'>;
}

const sym = (n: string): Node => scalar.symbol(n);
const mul = (a: Node, b: Node): Node => scalar.op('*', [a, b]);
const add = (a: Node, b: Node): Node => scalar.op('+', [a, b]);

const x9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const yOutlier = [0.9, 3.1, 5.2, 6.8, 9.1, 30, 13.2, 14.9, 17.1];

export const ROBUST_CASES: RobustCase[] = [
  {
    name: 'line a*x+b, one gross outlier',
    node: () => add(mul(sym('a'), sym('x')), sym('b')),
    columns: [x9],
    y: yOutlier,
    variables: ['x'],
    options: { parameters: ['a', 'b'], initial: [0.5, 0], maxIterations: 200 },
  },
  {
    name: 'line a*x+b, weights, outlier',
    node: () => add(mul(sym('a'), sym('x')), sym('b')),
    columns: [x9],
    y: yOutlier,
    variables: ['x'],
    options: {
      parameters: ['a', 'b'],
      initial: [0.5, 0],
      maxIterations: 200,
      weights: new Float64Array([1, 2, 1, 0.5, 3, 0.25, 1, 2, 1]),
    },
  },
  {
    name: 'quadratic with the middle parameter fixed by bounds',
    node: () => add(add(mul(sym('a'), sym('x')), mul(sym('b'), mul(sym('x'), sym('x')))), sym('c')),
    columns: [x9],
    y: [1.1, 2.6, 5.3, 9.8, 16.1, 24.7, 35.2, 48.1, 62.9],
    variables: ['x'],
    options: {
      parameters: ['a', 'b', 'c'],
      initial: [0.2, 0.5, 0.1],
      bounds: [
        [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
        [0.5, 0.5],
        [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
      ],
      maxIterations: 200,
    },
  },
  {
    name: 'two variables, weights, residuals on both sides of the Huber clamp',
    node: () => add(add(mul(sym('a'), sym('u')), mul(sym('b'), sym('v'))), sym('c')),
    columns: [
      [0, 1, 2, 3, 4, 5, 6, 7],
      [1, 0, 2, 1, 3, 2, 4, 3],
    ],
    y: [0.4, 1.2, 3.9, 4.1, 8.8, 7.0, 14.5, 11.0],
    variables: ['u', 'v'],
    options: {
      parameters: ['a', 'b', 'c'],
      initial: [0, 0, 0],
      maxIterations: 300,
      weights: new Float64Array([1, 1, 2, 2, 0.5, 0.5, 3, 1]),
    },
  },
  {
    name: 'b*exp(a*x) undershoots the data, the step overflows, and a row goes inactive',
    node: () => mul(sym('b'), scalar.call('exp', mul(sym('a'), sym('x')))),
    columns: [[0, 20, 40, 60, 80, 100]],
    y: [1, 2.2e4, 4.8e8, 1.1e13, 2.4e17, 5.2e21],
    variables: ['x'],
    options: { parameters: ['a', 'b'], initial: [0.1, 1], maxIterations: 200 },
  },
  {
    name: 'exact data: zero residual everywhere (L1 sign(0) is 0)',
    node: () => add(mul(sym('a'), sym('x')), sym('b')),
    columns: [x9],
    y: x9.map((v) => 2 * v + 1),
    variables: ['x'],
    options: { parameters: ['a', 'b'], initial: [2, 1], maxIterations: 50 },
  },
];
