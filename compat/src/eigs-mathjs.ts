/**
 * Compat-only mathjs 15.3.0 `eigs` (#1561).
 *
 * Native `@danielsimonjr/mathts-functions` `eigs` stays `correctEigs`. This
 * module instantiates the mathjs factory port that lives under
 * `compat/src/mathjs-eigs/` so the critical functions library is not the
 * home of mathjs quirks (precision collapse, non-unit vectors, value order).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { createEigs } from './mathjs-eigs/eigs.js';

const config = mathFunctions.config();
const scope: Record<string, unknown> = {
  ...(mathFunctions as unknown as Record<string, unknown>),
  config,
  typed: mathFunctions.factory_mathjsCompat.createCompatTyped(),
};

const computeEigs = createEigs(scope) as (...args: unknown[]) => {
  values: unknown[];
  eigenvectors?: { value: unknown; vector: unknown }[];
};

let instanceBignumber: ((value: unknown) => unknown) | null = null;

/** Called from compat `create(all)` so eigenvalues use InstanceBigNumber (mathjs dogfood #1791). */
export function wireCompatEigsInstanceBignumber(bn: (value: unknown) => unknown): void {
  instanceBignumber = bn;
}

function promoteInstanceBigNumbers(result: ReturnType<typeof computeEigs>): typeof result {
  const { values } = result;
  if (!values?.length || !instanceBignumber) return result;
  const head = values[0];
  if (
    head === null ||
    typeof head !== 'object' ||
    !('isBigNumber' in head) ||
    (head as { isBigNumber?: boolean }).isBigNumber !== true
  ) {
    return result;
  }
  const inst = (v: unknown) => instanceBignumber!(v);
  values.forEach((v, i) => {
    values[i] = inst(v);
  });
  for (const pair of result.eigenvectors ?? []) {
    pair.value = inst(pair.value);
  }
  return result;
}

export const compatMathjsEigs = (...args: unknown[]) =>
  promoteInstanceBigNumbers(computeEigs(...args));
