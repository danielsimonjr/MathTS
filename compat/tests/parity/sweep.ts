import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { pair, show, type HarnessInstance } from './oracle.js';

export type Lib = HarnessInstance;
export type Outcome = { value: string } | { error: string; arity?: boolean };

const ARITY_ERROR = /Too (few|many) arguments/;

export function outcome(L: Lib, run: () => unknown): Outcome {
  try {
    const v = run();
    if (typeof v === 'function') return { value: 'function ' + (v as { name?: string }).name };
    const formatted = show(L as never, v);
    return { value: formatted.length > 300 ? formatted.slice(0, 300) : formatted };
  } catch (e) {
    const err = e as Error;
    return { error: err.name, arity: ARITY_ERROR.test(err.message) };
  }
}

// Pool of 33 argument values mixing the mathjs types (tracker #1590 method).
const POOL: unknown[] = [
  0,
  1,
  2,
  3,
  -3,
  0.5,
  2.5,
  -0.5,
  1e-7,
  1e6,
  100,
  1 / 3,
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
  '2',
  'abc',
  2n,
  -3n,
  [1, 2],
  [0, 0],
  [
    [1, 2],
    [3, 4],
  ],
  [],
  '5 cm',
];

function buildPool(L: Lib): unknown[] {
  return [
    ...POOL,
    (L.complex as (re: number, im: number) => unknown)(1, 2),
    (L.bignumber as (v: unknown) => unknown)(2),
    (L.bignumber as (v: unknown) => unknown)(0.5),
    (L.fraction as (n: number, d: number) => unknown)(1, 3),
    (L.unit as (v: string) => unknown)('5 cm'),
    (L.unit as (v: string) => unknown)('2 inch'),
    (L.matrix as (v: unknown) => unknown)([1, 2]),
    (L.sparse as (v: unknown) => unknown)([[0, 1]]),
  ];
}

// Class constructors: the value harness compares function calls; constructor probes
// (mathjs throws SyntaxError, compat TypeError, on a new-less call) are a separate surface.
const CLASS_NAMES = new Set([
  'BigNumber',
  'Complex',
  'Fraction',
  'Matrix',
  'DenseMatrix',
  'SparseMatrix',
  'ImmutableDenseMatrix',
  'FibonacciHeap',
  'Spa',
  'Chain',
  'ResultSet',
  'Help',
  'Parser',
  'Unit',
  'Range',
  'Index',
  'Node',
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionAssignmentNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'SymbolNode',
  'ArgumentsError',
  'DimensionError',
  'IndexError',
]);

// Functions that allocate an output whose size follows a numeric argument: calling them
// with a huge pool value would exhaust the heap for no parity information.
const ALLOCATING = new Set([
  'ones',
  'zeros',
  'matrix',
  'sparse',
  'identity',
  'resize',
  'reshape',
  'repmat',
  'range',
  'diag',
  'eye',
  'fft',
  'ifft',
  'combine',
  'composition',
  'stirlingS2',
  'bellNumbers',
  'eigs',
  'schur',
  'lu',
  'qr',
  'lup',
  'sla',
  'slu',
  'lusolve',
  'lsolve',
  'usolve',
  'lsolveAll',
  'usolveAll',
  'inv',
  'expm',
  'sqrtm',
  'kron',
  'cross',
  'det',
]);

// Functions whose call mutates shared state, prints, or is not a plain value function.
const SKIP_FUNCTIONS = new Set([
  'import',
  'config',
  'create',
  'typed',
  'on',
  'off',
  'once',
  'emit',
  'print',
  'replacer',
  'reviver',
  'factory',
  'expression',
  'mathWithTransform',
  'help',
  'doc',
  'docs',
  'chain',
  'parser',
  'evaluate',
  'compile',
  'parse',
  'random',
  'randomInt',
  'pickRandom',
]);

/** G07 factory logical fns on compat reject mathjs-typed pool values; compare with compat types. */
const FACTORY_TYPED_POOL_OPS = new Set(['nullish', 'not', 'and', 'or', 'xor']);

export function sweepPool(options?: { only?: string[] }): {
  labels: Set<string>;
  arities: Map<string, Set<number>>;
} {
  const labels = new Set<string>();
  const arities = new Map<string, Set<number>>();
  const { mathjs, compat } = pair({});
  const oraclePool = buildPool(mathjs);
  const compatPool = buildPool(compat);
  const compatRecord = compat as unknown as Record<string, unknown>;
  const oracleRecord = mathjs as unknown as Record<string, unknown>;
  const names = Object.keys(compatRecord).filter(
    (k) =>
      typeof compatRecord[k] === 'function' &&
      !SKIP_FUNCTIONS.has(k) &&
      !CLASS_NAMES.has(k) &&
      (!options?.only || options.only.includes(k))
  );
  for (const name of names) {
    const fnO = oracleRecord[name] as (...args: unknown[]) => unknown;
    const fnC = compatRecord[name] as (...args: unknown[]) => unknown;
    if (typeof fnO !== 'function' || typeof fnC !== 'function') continue;
    const declared = fnO.length ?? 0;
    const widths = new Set<number>([Math.max(declared, 1)]);
    // Extra unary width only for a targeted `only` sweep (G18 F2: zeta.length is 2
    // but mathjs still accepts one argument). The full-surface pool stays on the
    // declared arity so Test stays inside the 20-minute job wall.
    if (declared > 1 && options?.only) widths.add(1);
    const seen = new Set<number>();
    arities.set(name, seen);
    const useCompatPool = FACTORY_TYPED_POOL_OPS.has(name);
    for (let a = 0; a < oraclePool.length; a++) {
      const tryCall = (poolArgs: unknown[], compatArgs: unknown[]): void => {
        if (
          ALLOCATING.has(name) &&
          poolArgs.some((x) => typeof x === 'number' && Math.abs(x) > 1000)
        ) {
          return;
        }
        seen.add(poolArgs.length);
        const o = outcome(mathjs, () => fnO.apply(mathjs, poolArgs));
        // An arity rejection of the oracle is one divergence per function (#1587), not one
        // per argument combination.
        if ('error' in o && o.arity) {
          labels.add(`${name}: mathjs rejects ${poolArgs.length} argument(s) on the pool`);
          return;
        }
        const c = outcome(compat, () => fnC.apply(compat, compatArgs));
        if (JSON.stringify(o) !== JSON.stringify(c)) {
          labels.add(`${name}: (${poolArgs.map((x) => show(mathjs, x)).join(', ')})`);
        }
      };
      for (const width of widths) {
        if (width <= 1) {
          const compatArgs = useCompatPool ? [compatPool[a]] : [oraclePool[a]];
          tryCall([oraclePool[a]], compatArgs);
          continue;
        }
        const maxWidth = Math.min(8, oraclePool.length);
        for (let b = 0; b < maxWidth; b++) {
          const compatArgs = useCompatPool
            ? [compatPool[a], compatPool[b]]
            : [oraclePool[a], oraclePool[b]];
          tryCall([oraclePool[a], oraclePool[b]], compatArgs);
        }
      }
    }
  }
  return { labels, arities };
}

export const DOC_CONFIGS: Record<string, unknown>[] = [
  {},
  { number: 'BigNumber' },
  { matrix: 'Array' },
];

export async function docsExamples(): Promise<{
  total: number;
  perName: Map<string, string[]>;
}> {
  // The oracle's embedded docs live inside the mathjs package; a relative import reaches
  // them without a subpath export.
  const mod =
    (await import('../../../node_modules/mathjs/lib/esm/expression/embeddedDocs/embeddedDocs.js')) as {
      embeddedDocs: Record<string, { examples?: string[] }>;
    };
  const perName = new Map<string, string[]>();
  let total = 0;
  for (const [name, doc] of Object.entries(mod.embeddedDocs)) {
    const examples = doc.examples ?? [];
    if (examples.length) {
      perName.set(name, examples);
      total += examples.length;
    }
  }
  return { total, perName };
}

export function sweepDocs(perName: Map<string, string[]>): {
  labels: Set<string>;
  total: number;
} {
  const labels = new Set<string>();
  let total = 0;
  for (const config of DOC_CONFIGS) {
    const configTag = JSON.stringify(config);
    const { mathjs, compat } = pair(config);
    for (const examples of perName.values()) {
      for (const example of examples) {
        total++;
        const o = outcome(mathjs, () => mathjs.evaluate(example));
        const c = outcome(compat, () => compat.evaluate(example));
        if (JSON.stringify(o) !== JSON.stringify(c)) {
          labels.add(`${configTag} ${example}`);
        }
      }
    }
  }
  return { labels, total };
}

export function compatFunctionNames(): string[] {
  const compat = createCompat(compatAll, {}) as unknown as Record<string, unknown>;
  return Object.keys(compat).filter((k) => typeof compat[k] === 'function');
}
