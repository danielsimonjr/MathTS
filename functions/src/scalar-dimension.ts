/**
 * SI dimension inference and parameter-dimension solving over {@link ScalarNode}.
 *
 * {@link inferScalarDimension} walks a scalar tree with rational exponents on the
 * seven base dimensions. {@link solveParameterDimensions} extends that walk with
 * linear forms and {@link rationalNullspace}.
 *
 * @packageDocumentation
 */

import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { Fraction, SI_DIMENSION_LENGTH, type SiDimensionVector } from '@danielsimonjr/mathts-core';
import { hasOwnProperty } from './utils/object.js';
import { rationalNullspace } from './numeric/rational-nullspace.js';

/** SI dimension vector with exact {@link Fraction} exponents. */
export type RationalDimension = SiDimensionVector;

/** Result of {@link inferScalarDimension}. */
export type DimensionInference =
  | { readonly ok: true; readonly dimension: RationalDimension }
  | {
      readonly ok: false;
      readonly violation:
        | 'add-mismatch'
        | 'transcendental-arg-not-dimensionless'
        | 'non-literal-exponent-on-dimensional-base'
        | 'unknown-symbol';
      readonly path: readonly number[];
    };

/** Result of {@link solveParameterDimensions}. */
export type ParameterDimensionResult =
  | { readonly solved: Readonly<Record<string, RationalDimension>> }
  | { readonly underdetermined: readonly string[] }
  | { readonly inconsistent: true };

const ADD_MISMATCH = 'add-mismatch' as const;

type DimensionViolation =
  | typeof ADD_MISMATCH
  | 'transcendental-arg-not-dimensionless'
  | 'non-literal-exponent-on-dimensional-base'
  | 'unknown-symbol';

const TRANSCENDENTAL_CALLS = new Set<string>([
  'exp',
  'log',
  'log2',
  'log10',
  'sin',
  'cos',
  'tan',
  'sinh',
  'cosh',
  'tanh',
]);

const ZERO = new Fraction(0n, 1n);
const ONE = new Fraction(1n, 1n);
const NEG_ONE = new Fraction(-1n, 1n);

/** One SI component as a linear form in parameter dimensions. */
interface ComponentForm {
  known: Fraction;
  coeffs: Fraction[];
}

type LinearDimension = ComponentForm[];

interface InferContext {
  readonly mode: 'infer';
  readonly dims: Readonly<Record<string, RationalDimension>>;
}

interface SolveContext {
  readonly mode: 'solve';
  readonly dims: Readonly<Record<string, RationalDimension>>;
  readonly parameters: readonly string[];
  readonly paramIndex: ReadonlyMap<string, number>;
}

type WalkContext = InferContext | SolveContext;

type WalkSuccess = { readonly ok: true; readonly forms: LinearDimension };
type WalkFailure =
  | { readonly ok: false; readonly violation: DimensionViolation; readonly path: readonly number[] }
  | { readonly ok: false; readonly inconsistent: true }
  | { readonly ok: false; readonly underdetermined: readonly string[] };

function validateDimensionVector(vector: RationalDimension, label = 'dimension vector'): void {
  if (
    !Array.isArray(vector) ||
    vector.length !== SI_DIMENSION_LENGTH ||
    !vector.every((entry) => entry instanceof Fraction)
  ) {
    throw new TypeError(`${label} must be a ${SI_DIMENSION_LENGTH}-tuple of Fractions`);
  }
}

function readDimension(
  dims: Readonly<Record<string, RationalDimension>>,
  name: string
): RationalDimension | null {
  if (!hasOwnProperty(dims, name)) {
    return null;
  }
  const vector = dims[name];
  validateDimensionVector(vector, `dims['${name}']`);
  return vector;
}

function formsFromDimension(vector: RationalDimension, nParams: number): LinearDimension {
  validateDimensionVector(vector);
  return vector.map((known) => ({
    known,
    coeffs: Array.from({ length: nParams }, () => ZERO),
  }));
}

function zeroForms(nParams: number): LinearDimension {
  return Array.from({ length: SI_DIMENSION_LENGTH }, () => ({
    known: ZERO,
    coeffs: Array.from({ length: nParams }, () => ZERO),
  }));
}

function formEquals(a: ComponentForm, b: ComponentForm): boolean {
  if (!a.known.equals(b.known)) return false;
  for (let i = 0; i < a.coeffs.length; i++) {
    if (!a.coeffs[i].equals(b.coeffs[i])) return false;
  }
  return true;
}

function formsEqual(a: LinearDimension, b: LinearDimension): boolean {
  for (let i = 0; i < SI_DIMENSION_LENGTH; i++) {
    if (!formEquals(a[i], b[i])) return false;
  }
  return true;
}

function formIsZero(form: ComponentForm): boolean {
  if (!form.known.equals(ZERO)) return false;
  return form.coeffs.every((coeff) => coeff.equals(ZERO));
}

function formsAreDimensionless(forms: LinearDimension): boolean {
  return forms.every(formIsZero);
}

function formAdd(a: ComponentForm, b: ComponentForm): ComponentForm {
  return {
    known: a.known.add(b.known),
    coeffs: a.coeffs.map((coeff, i) => coeff.add(b.coeffs[i])),
  };
}

function formSub(a: ComponentForm, b: ComponentForm): ComponentForm {
  return {
    known: a.known.sub(b.known),
    coeffs: a.coeffs.map((coeff, i) => coeff.sub(b.coeffs[i])),
  };
}

function formScale(form: ComponentForm, exponent: Fraction): ComponentForm {
  return {
    known: form.known.mul(exponent),
    coeffs: form.coeffs.map((coeff) => coeff.mul(exponent)),
  };
}

function scaleForms(forms: LinearDimension, exponent: Fraction): LinearDimension {
  return forms.map((form) => formScale(form, exponent));
}

function addForms(left: LinearDimension, right: LinearDimension): LinearDimension {
  return left.map((form, i) => formAdd(form, right[i]));
}

function subForms(left: LinearDimension, right: LinearDimension): LinearDimension {
  return left.map((form, i) => formSub(form, right[i]));
}

function formsToDimension(forms: LinearDimension): RationalDimension {
  return [
    forms[0].known,
    forms[1].known,
    forms[2].known,
    forms[3].known,
    forms[4].known,
    forms[5].known,
    forms[6].known,
  ];
}

function paramSet(parameters: readonly string[]): ReadonlySet<string> {
  return new Set(parameters);
}

function collectParametersInNode(
  node: ScalarNode,
  parameters: ReadonlySet<string>,
  found: Set<string>
): void {
  switch (node.kind) {
    case 'number':
      return;
    case 'symbol':
      if (parameters.has(node.name)) found.add(node.name);
      return;
    case 'op':
      for (const child of node.args) collectParametersInNode(child, parameters, found);
      return;
    case 'call':
      collectParametersInNode(node.arg, parameters, found);
      return;
  }
}

function orderedUnderdeterminedParameters(
  parameters: readonly string[],
  involved: ReadonlySet<string>
): readonly string[] {
  return parameters.filter((name) => involved.has(name));
}

function violationResult(violation: DimensionViolation, path: readonly number[]): WalkFailure {
  return { ok: false, violation, path };
}

function walkScalar(
  node: ScalarNode,
  path: readonly number[],
  ctx: WalkContext
): WalkSuccess | WalkFailure {
  const nParams = ctx.mode === 'solve' ? ctx.parameters.length : 0;

  switch (node.kind) {
    case 'number':
      return { ok: true, forms: zeroForms(nParams) };

    case 'symbol': {
      const bound = readDimension(ctx.dims, node.name);
      if (ctx.mode === 'infer') {
        if (bound === null) {
          return violationResult('unknown-symbol', path);
        }
        return { ok: true, forms: formsFromDimension(bound, 0) };
      }
      if (bound !== null) {
        return { ok: true, forms: formsFromDimension(bound, nParams) };
      }
      const index = ctx.paramIndex.get(node.name);
      if (index === undefined) {
        return { ok: false, inconsistent: true };
      }
      const forms = zeroForms(nParams);
      for (let k = 0; k < SI_DIMENSION_LENGTH; k++) {
        forms[k].coeffs[index] = ONE;
      }
      return { ok: true, forms };
    }

    case 'call': {
      const arg = walkScalar(node.arg, [...path, 0], ctx);
      if (!arg.ok) return arg;
      if (node.fn === 'abs') {
        return { ok: true, forms: arg.forms };
      }
      if (TRANSCENDENTAL_CALLS.has(node.fn)) {
        if (!formsAreDimensionless(arg.forms)) {
          return violationResult('transcendental-arg-not-dimensionless', path);
        }
        return { ok: true, forms: zeroForms(nParams) };
      }
      return violationResult('transcendental-arg-not-dimensionless', path);
    }

    case 'op': {
      if (node.op === '^') {
        if (node.args.length !== 2) {
          throw new TypeError("inferScalarDimension: '^' needs exactly 2 args");
        }
        if (ctx.mode === 'solve') {
          const involved = new Set<string>();
          collectParametersInNode(node.args[1], paramSet(ctx.parameters), involved);
          if (involved.size > 0) {
            return {
              ok: false,
              underdetermined: orderedUnderdeterminedParameters(ctx.parameters, involved),
            };
          }
        }
        const base = walkScalar(node.args[0], [...path, 0], ctx);
        if (!base.ok) return base;
        const exponentNode = node.args[1];
        if (exponentNode.kind === 'number') {
          const exponent = Number.isInteger(exponentNode.value)
            ? new Fraction(BigInt(exponentNode.value), 1n)
            : Fraction.fromNumber(exponentNode.value);
          return { ok: true, forms: scaleForms(base.forms, exponent) };
        }
        if (formsAreDimensionless(base.forms)) {
          return { ok: true, forms: zeroForms(nParams) };
        }
        return violationResult('non-literal-exponent-on-dimensional-base', path);
      }

      const args = node.args;
      if (args.length === 0) {
        return { ok: true, forms: zeroForms(nParams) };
      }
      if (args.length === 1) {
        return walkScalar(args[0], [...path, 0], ctx);
      }

      if (node.op === '+' || node.op === '-') {
        let acc = walkScalar(args[0], [...path, 0], ctx);
        if (!acc.ok) return acc;
        for (let i = 1; i < args.length; i++) {
          const next = walkScalar(args[i], [...path, i], ctx);
          if (!next.ok) return next;
          if (!formsEqual(acc.forms, next.forms)) {
            return violationResult(ADD_MISMATCH, path);
          }
        }
        return { ok: true, forms: acc.forms };
      }

      let acc = walkScalar(args[0], [...path, 0], ctx);
      if (!acc.ok) return acc;
      for (let i = 1; i < args.length; i++) {
        const next = walkScalar(args[i], [...path, i], ctx);
        if (!next.ok) return next;
        acc = {
          ok: true,
          forms:
            node.op === '*' ? addForms(acc.forms, next.forms) : subForms(acc.forms, next.forms),
        };
      }
      return acc;
    }
  }
}

/**
 * Infer the SI dimension of a scalar tree, or report a structural violation.
 */
export function inferScalarDimension(
  node: ScalarNode,
  dims: Readonly<Record<string, RationalDimension>>
): DimensionInference {
  const result = walkScalar(node, [], { mode: 'infer', dims });
  if (!result.ok) {
    if ('inconsistent' in result || 'underdetermined' in result) {
      throw new Error('inferScalarDimension: internal walk failure');
    }
    return { ok: false, violation: result.violation, path: result.path };
  }
  return { ok: true, dimension: formsToDimension(result.forms) };
}

function buildComponentSystem(
  form: ComponentForm,
  target: Fraction,
  n: number,
  dimensionlessOnly: boolean
): { readonly rows: Fraction[][]; readonly rhs: Fraction[] } {
  const rows: Fraction[][] = [];
  const rhs: Fraction[] = [];
  if (form.coeffs.some((coeff) => !coeff.equals(ZERO))) {
    rows.push(form.coeffs.slice());
    rhs.push(target.sub(form.known));
  }
  if (dimensionlessOnly) {
    for (let j = 0; j < n; j++) {
      const row = Array.from({ length: n }, () => ZERO);
      row[j] = ONE;
      rows.push(row);
      rhs.push(ZERO);
    }
  }
  return { rows, rhs };
}

function homogeneousParameterNames(
  rows: Fraction[][],
  parameters: readonly string[]
): readonly string[] {
  const { basis } =
    rows.length === 0
      ? rationalNullspace([], { columns: parameters.length })
      : rationalNullspace(rows);
  const names = new Set<string>();
  for (const vector of basis) {
    for (let j = 0; j < parameters.length; j++) {
      if (!vector[j].equals(ZERO)) names.add(parameters[j]);
    }
  }
  return parameters.filter((name) => names.has(name));
}

function solveComponent(
  form: ComponentForm,
  target: Fraction,
  parameters: readonly string[],
  dimensionlessOnly: boolean
):
  | { readonly values: Fraction[] }
  | { readonly inconsistent: true }
  | { readonly underdetermined: true } {
  const n = parameters.length;
  const { rows, rhs } = buildComponentSystem(form, target, n, dimensionlessOnly);

  if (rows.length === 0) {
    return { underdetermined: true };
  }

  if (homogeneousParameterNames(rows, parameters).length > 0) {
    return { underdetermined: true };
  }

  const augmented = rows.map((row, rowIndex) => [...row, rhs[rowIndex].mul(NEG_ONE)]);
  const { basis } = rationalNullspace(augmented);
  for (const vector of basis) {
    const scale = vector[n];
    if (!scale.equals(ZERO)) {
      return { values: vector.slice(0, n).map((entry) => entry.div(scale)) };
    }
  }

  const b = target.sub(form.known);
  return b.equals(ZERO)
    ? { values: Array.from({ length: n }, () => ZERO) }
    : { inconsistent: true };
}

/**
 * Solve unknown parameter dimensions so the tree matches a target dimension.
 */
export function solveParameterDimensions(
  node: ScalarNode,
  dims: Readonly<Record<string, RationalDimension>>,
  target: RationalDimension,
  parameters: readonly string[],
  options?: { readonly dimensionlessOnly?: boolean }
): ParameterDimensionResult {
  validateDimensionVector(target, 'target');
  const dimensionlessOnly = options?.dimensionlessOnly ?? false;
  const paramIndex = new Map<string, number>();
  for (let i = 0; i < parameters.length; i++) {
    paramIndex.set(parameters[i], i);
  }

  const walked = walkScalar(node, [], {
    mode: 'solve',
    dims,
    parameters,
    paramIndex,
  });
  if (!walked.ok) {
    if ('underdetermined' in walked) {
      return { underdetermined: walked.underdetermined };
    }
    return { inconsistent: true };
  }

  if (parameters.length === 0) {
    for (let k = 0; k < SI_DIMENSION_LENGTH; k++) {
      if (!walked.forms[k].known.equals(target[k])) {
        return { inconsistent: true };
      }
    }
    return { solved: {} };
  }

  const underdetermined = new Set<string>();
  const valuesByComponent: Fraction[][] = Array.from({ length: SI_DIMENSION_LENGTH }, () => []);

  for (let k = 0; k < SI_DIMENSION_LENGTH; k++) {
    const form = walked.forms[k];
    const names = homogeneousParameterNames(
      buildComponentSystem(form, target[k], parameters.length, dimensionlessOnly).rows,
      parameters
    );
    if (names.length > 0) {
      for (const name of names) underdetermined.add(name);
      continue;
    }

    const solved = solveComponent(form, target[k], parameters, dimensionlessOnly);
    if ('inconsistent' in solved) {
      return { inconsistent: true };
    }
    if ('underdetermined' in solved) {
      for (const name of parameters) underdetermined.add(name);
      continue;
    }
    valuesByComponent[k] = solved.values;
  }

  if (underdetermined.size > 0) {
    return { underdetermined: parameters.filter((name) => underdetermined.has(name)) };
  }

  const solved: Record<string, RationalDimension> = {};
  for (let j = 0; j < parameters.length; j++) {
    solved[parameters[j]] = [
      valuesByComponent[0][j],
      valuesByComponent[1][j],
      valuesByComponent[2][j],
      valuesByComponent[3][j],
      valuesByComponent[4][j],
      valuesByComponent[5][j],
      valuesByComponent[6][j],
    ];
  }
  return { solved };
}
