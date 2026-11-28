import { IndexError } from '@danielsimonjr/mathts-core/internal';

const MATHTS_SCALAR_GUARD = /^(\w+): unexpected type (.+) at index (\d+)$/;

const SCALAR_FACTORY_EXPECTED: Record<string, string> = {
  add: 'number or bigint or string or boolean or BigNumber or Complex or Fraction',
  addScalar: 'number or bigint or string or boolean or BigNumber or Complex or Fraction',
  multiply: 'number or Unit or bigint or string or boolean or BigNumber or Complex or Fraction',
  multiplyScalar:
    'number or Unit or bigint or string or boolean or BigNumber or Complex or Fraction',
};

function formatMathjsActual(typeLabel: string): string {
  if (typeLabel === 'null') return 'identifier | null';
  if (typeLabel === 'undefined') return 'identifier | undefined';
  return typeLabel;
}

function remapScalarDispatchError(err: TypeError): TypeError | null {
  const guard = MATHTS_SCALAR_GUARD.exec(err.message);
  if (!guard) return null;
  const fnName = guard[1];
  const factoryName =
    fnName === 'add' || fnName === 'multiply' ? `${fnName}Scalar` : (fnName ?? 'addScalar');
  const expected = SCALAR_FACTORY_EXPECTED[factoryName] ?? SCALAR_FACTORY_EXPECTED[fnName ?? ''];
  if (expected === undefined) return null;
  const actual = formatMathjsActual(guard[2] ?? '');
  return new TypeError(
    `Unexpected type of argument in function ${factoryName} (expected: ${expected}, actual: ${actual}, index: ${guard[3]})`
  );
}

function remapIndexErrorLike(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { isIndexError?: boolean }).isIndexError === true
  ) {
    const e = error as IndexError;
    const message = e.message;
    if (/ < 0\)$/.test(message)) {
      return new IndexError(e.index, 1, e.max === undefined ? undefined : e.max + 1);
    }
    if (/[<>]/.test(message) && !/< 0\)/.test(message)) {
      return error;
    }
    if (/^Index out of range \(-?\d+\)$/.test(message)) {
      return new IndexError(e.index, 1, e.index);
    }
    return new IndexError(
      e.index + 1,
      e.min === undefined ? undefined : e.min + 1,
      e.max === undefined ? undefined : e.max + 1
    );
  }
  return error;
}

/** Remap evaluate errors to mathjs 15.3.0 security-test messages (#1777). */
export function remapMathjsSandboxEvaluateError(error: unknown): never {
  const indexRemapped = remapIndexErrorLike(error);
  if (indexRemapped !== error) throw indexRemapped;
  if (error instanceof Error) {
    if (/Index must be an integer/.test(error.message)) {
      if (/\(value: \[object Object\]\)/.test(error.message)) {
        throw new Error('Array expected for index');
      }
    }
    if (
      error instanceof TypeError &&
      /Unexpected type of argument in function subset/.test(error.message) &&
      /actual: any/.test(error.message)
    ) {
      throw new TypeError(error.message.replace('actual: any', 'actual: Object'));
    }
    if (error instanceof TypeError) {
      const remapped = remapScalarDispatchError(error);
      if (remapped !== null) throw remapped;
    }
  }
  throw error;
}
