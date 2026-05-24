/**
 * Unit type — dimensional analysis, composition, conversion, and pretty-print.
 *
 * A {@link Unit} couples a numeric magnitude to a dimensional signature derived
 * from a registry of named units (see {@link ./unit-definitions}). Units are
 * **immutable**: every operation returns a new instance. The canonical
 * representation always stores the value in SI base units, regardless of how
 * the unit was constructed — so `new Unit(5, 'km').value === 5000` (metres).
 * The original notation is preserved on the instance for round-trip display.
 *
 * Design notes (intentional differences from mathjs's `Unit` class):
 * - **Immutable value semantics** instead of mutable JS prototype-class style.
 * - **No closure over a `math` instance.** Unit is self-contained — no
 *   dependency on `addScalar`, `format`, `BigNumber`, etc. Values are plain
 *   JS numbers.
 * - **`dimensions` is a struct** (a record over the seven SI bases) rather
 *   than mathjs's array indexed by `BASE_DIMENSIONS`. Cheaper to work with in
 *   TS, and lets the field be `Readonly<Dimensions>`.
 * - **Temperature offsets are honoured only for single-temperature-degree
 *   units** (e.g. `°C` alone, not `°C/s`), matching mathjs but stated
 *   explicitly here.
 *
 * @module @danielsimonjr/mathts-core/types/unit
 */

import {
  ALL_UNITS,
  DIMENSIONLESS,
  type Dimensions,
  UNIT_ALIASES,
  type UnitDef,
  dim,
  getUnitDef,
} from './unit-definitions.js';
import { BEST_PREFIXES, SI_PREFIXES, SI_PREFIX_KEYS } from './unit-prefixes.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a unit operation requires matching dimensions but the operands
 * disagree. Carries the offending dimension vectors for debugging.
 */
export class DimensionMismatchError extends Error {
  readonly name = 'DimensionMismatchError';
  constructor(
    readonly left: Dimensions,
    readonly right: Dimensions,
    op: string
  ) {
    super(
      `Dimension mismatch in ${op}: ` + `${formatDimensions(left)} vs ${formatDimensions(right)}`
    );
  }
}

/** Thrown when a notation string cannot be parsed against the registry. */
export class UnitParseError extends Error {
  readonly name = 'UnitParseError';
  constructor(notation: string, reason: string) {
    super(`Cannot parse unit notation "${notation}": ${reason}`);
  }
}

// ---------------------------------------------------------------------------
// Dimensions helpers
// ---------------------------------------------------------------------------

const DIM_KEYS: ReadonlyArray<keyof Dimensions> = [
  'length',
  'mass',
  'time',
  'current',
  'temperature',
  'amount',
  'luminosity',
];

function dimsEqual(a: Dimensions, b: Dimensions): boolean {
  for (const k of DIM_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function dimsAdd(a: Dimensions, b: Dimensions): Dimensions {
  return {
    length: a.length + b.length,
    mass: a.mass + b.mass,
    time: a.time + b.time,
    current: a.current + b.current,
    temperature: a.temperature + b.temperature,
    amount: a.amount + b.amount,
    luminosity: a.luminosity + b.luminosity,
  };
}

function dimsSub(a: Dimensions, b: Dimensions): Dimensions {
  return {
    length: a.length - b.length,
    mass: a.mass - b.mass,
    time: a.time - b.time,
    current: a.current - b.current,
    temperature: a.temperature - b.temperature,
    amount: a.amount - b.amount,
    luminosity: a.luminosity - b.luminosity,
  };
}

function dimsScale(a: Dimensions, n: number): Dimensions {
  return {
    length: a.length * n,
    mass: a.mass * n,
    time: a.time * n,
    current: a.current * n,
    temperature: a.temperature * n,
    amount: a.amount * n,
    luminosity: a.luminosity * n,
  };
}

function isDimensionless(d: Dimensions): boolean {
  return dimsEqual(d, DIMENSIONLESS);
}

function formatDimensions(d: Dimensions): string {
  const parts: string[] = [];
  for (const k of DIM_KEYS) {
    const e = d[k];
    if (e !== 0) parts.push(`${k}^${e}`);
  }
  return parts.length === 0 ? 'dimensionless' : parts.join('·');
}

// ---------------------------------------------------------------------------
// Notation lookup: prefix + unit-name resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single atomic unit token (e.g. "km", "ms", "kg", "min") into a
 * `(multiplier, offset?, dimensions)` tuple.
 *
 * Resolution order:
 *   1. Apply registered aliases (e.g. "°C" → "degC").
 *   2. Try the bare name against the unit registry (longest match wins).
 *   3. If no match, attempt prefix + unit splits (longest prefix first).
 *
 * The prefix-ambiguity rule from the design spec: prefix only applies when
 * no plain match exists. So `min` resolves to "minute" (registered unit),
 * never "milli + in". `mm` resolves to "milli + m" because `mm` is not in
 * the registry.
 */
function resolveAtom(token: string): {
  multiplier: number;
  offset: number;
  dimensions: Dimensions;
  prefix: string;
  base: string;
} {
  const aliased = UNIT_ALIASES[token] ?? token;

  // 1. Plain match.
  const direct = getUnitDef(aliased);
  if (direct) {
    return {
      multiplier: direct.multiplier,
      offset: direct.offset ?? 0,
      dimensions: direct.dimensions,
      prefix: '',
      base: aliased,
    };
  }

  // 2. Prefix + unit (longest prefix first).
  for (const prefix of SI_PREFIX_KEYS) {
    if (!aliased.startsWith(prefix) || aliased.length === prefix.length) continue;
    const rest = aliased.slice(prefix.length);
    const baseDef = getUnitDef(rest);
    if (!baseDef) continue;
    if (!baseDef.prefixable) continue;
    return {
      multiplier: baseDef.multiplier * SI_PREFIXES[prefix],
      // Offset is in base units, so prefix the multiplier but not the offset
      // (we never apply prefixes to temperature units in practice anyway).
      offset: baseDef.offset ?? 0,
      dimensions: baseDef.dimensions,
      prefix,
      base: rest,
    };
  }

  throw new UnitParseError(token, `unknown unit "${token}"`);
}

// ---------------------------------------------------------------------------
// Tokenizer + parser
// ---------------------------------------------------------------------------

interface AtomTerm {
  /** Resolved multiplier for this atom (incl. any prefix). */
  multiplier: number;
  /** Offset, if a temperature-like unit. Only meaningful when exponent is 1
   *  and used in a top-level standalone factor. */
  offset: number;
  /** Dimension contribution before the exponent is applied. */
  dimensions: Dimensions;
  /** Exponent to raise this atom to (e.g. `m^2` → exponent 2). */
  exponent: number;
  /** Original notation token (for round-trip pretty-print). */
  source: string;
}

/** Result of parsing a notation string. */
interface ParseResult {
  /** Optional leading numeric coefficient ("5 m/s" → 5). 1 if omitted. */
  scalar: number;
  /** All atomic factors composed multiplicatively (denominator atoms have
   *  already had their exponents negated). */
  atoms: AtomTerm[];
}

/**
 * Tokenize a unit-expression string. Returns the leading scalar (1 if absent)
 * and the trailing unit-expression substring.
 */
function splitScalar(input: string): { scalar: number; rest: string } {
  // Strict pattern: optional sign, digits, optional fraction, optional
  // exponent. We require at least one space (or end-of-string) between the
  // scalar and unit expression so that we don't accidentally eat the leading
  // digit of a unit like "1e-3" → exponent of preceding atom.
  const m = input.match(/^\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(.*)$/);
  if (m) {
    return { scalar: parseFloat(m[1]), rest: m[2].trim() };
  }
  // Scalar-only "5" with no unit token left.
  const scalarOnly = input.match(/^\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*$/);
  if (scalarOnly) {
    return { scalar: parseFloat(scalarOnly[1]), rest: '' };
  }
  return { scalar: 1, rest: input.trim() };
}

/**
 * Parse the unit-expression part (no leading scalar). Returns a list of
 * `AtomTerm`s whose exponents already include the effect of `/`-grouping.
 *
 * Grammar:
 *
 *     expr   := term (('*' | '·' | ' ') term | '/' term)*
 *     term   := atom ('^' exponent)?
 *     atom   := identifier   // letters + ° + µ
 *     exponent := signed integer or decimal
 *
 * All `/` are treated as flipping the sign of the *next* term's exponent
 * (not as the bulk denominator). This matches mathjs's behaviour:
 *     `m/s/s` parses as `m·s^-1·s^-1` = `m/s²`.
 */
function parseUnitExpr(expr: string): AtomTerm[] {
  if (expr === '' || expr === '1') return [];

  // Replace fancy multiplication symbols with '*' for simpler tokenization.
  // Note: we keep '/' distinct, and we keep '°', 'µ' as identifier chars.
  // Replace U+00B7 (·) and U+22C5 (⋅) with '*'.
  const normalized = expr.replace(/[·⋅]/g, '*');

  const atoms: AtomTerm[] = [];
  let pos = 0;
  // Sign starts positive (numerator). Each '/' flips the *next* atom only.
  let nextSign = 1;

  while (pos < normalized.length) {
    // Skip whitespace.
    while (pos < normalized.length && /\s/.test(normalized[pos])) pos++;
    if (pos >= normalized.length) break;

    // Handle separator '*' or '/'.
    const ch = normalized[pos];
    if (ch === '*') {
      pos++;
      continue;
    }
    if (ch === '/') {
      nextSign = -1;
      pos++;
      continue;
    }

    // Numeric literal "1" at this position is the conventional placeholder
    // for the empty numerator in "1/s", "1/min", etc. Skip it without
    // emitting an atom.
    if (ch === '1') {
      // Only accept a standalone "1" (followed by space, /, *, or EOS).
      const next = normalized[pos + 1];
      if (next === undefined || next === ' ' || next === '/' || next === '*') {
        pos++;
        continue;
      }
    }

    // Read an identifier: letters, digits-not-leading, °, µ.
    // Identifier rule: starts with a letter (or ° or µ); continues with
    // letters or ° (e.g. "degC", "°C").
    if (!/[A-Za-z°µΩ]/.test(ch)) {
      throw new UnitParseError(expr, `unexpected character "${ch}" at position ${pos}`);
    }
    const idStart = pos;
    while (pos < normalized.length && /[A-Za-z°µΩ]/.test(normalized[pos])) pos++;
    const identifier = normalized.slice(idStart, pos);

    // Optional exponent: "^" then signed number.
    let exponent = 1;
    if (pos < normalized.length && normalized[pos] === '^') {
      pos++;
      const expMatch = normalized.slice(pos).match(/^([+-]?\d+(?:\.\d+)?)/);
      if (!expMatch) {
        throw new UnitParseError(expr, `expected exponent after "^" at position ${pos}`);
      }
      exponent = parseFloat(expMatch[1]);
      pos += expMatch[1].length;
    } else {
      // Allow Unicode superscript digits trailing the identifier (², ³, …).
      const supMatch = normalized.slice(pos).match(/^([²³⁴⁵⁶⁷⁸⁹⁰¹]+)/);
      if (supMatch) {
        exponent = parseSuperscript(supMatch[1]);
        pos += supMatch[1].length;
      }
    }

    const resolved = resolveAtom(identifier);
    atoms.push({
      multiplier: resolved.multiplier,
      offset: resolved.offset,
      dimensions: resolved.dimensions,
      exponent: nextSign * exponent,
      source: identifier,
    });

    nextSign = 1; // Reset after consuming the atom.
  }

  return atoms;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

function parseSuperscript(s: string): number {
  let out = '';
  for (const ch of s) out += SUPERSCRIPT_MAP[ch] ?? ch;
  return parseInt(out, 10);
}

/**
 * Full parser: split off the scalar coefficient (if any), then parse the
 * remaining unit-expression.
 */
function parse(input: string): ParseResult {
  const { scalar, rest } = splitScalar(input);
  return { scalar, atoms: parseUnitExpr(rest) };
}

// ---------------------------------------------------------------------------
// The Unit class
// ---------------------------------------------------------------------------

/**
 * A physical quantity: a numeric magnitude paired with a dimensional
 * signature derived from named units.
 *
 * Construction examples:
 * ```ts
 * new Unit(5, 'm');        // 5 metres
 * new Unit(3.5, 'km/h');   // 3.5 km/h
 * new Unit(20, '°C');      // 20 °C
 * new Unit(1, 'kg·m/s²');  // 1 newton (composed)
 * ```
 *
 * All instances are immutable; every operation returns a new {@link Unit}.
 * The `value` field is always in SI base units, so:
 *
 * ```ts
 * new Unit(5, 'km').value;  // 5000  (canonical metres)
 * new Unit(20, '°C').value; // 293.15 (canonical kelvin)
 * ```
 */
export class Unit {
  /** Discriminator (matches the prototype-flag convention). */
  readonly type = 'Unit';
  /** Used by `isUnit()` and typed-function dispatch. */
  readonly isUnit = true;

  /** Numeric magnitude in **SI base units**. */
  readonly value: number;
  /** Dimensional signature. */
  readonly dimensions: Readonly<Dimensions>;
  /** Original notation string, preserved for `toString()` round-trip. */
  readonly notation: string;

  /**
   * Construct a Unit from a numeric value and a notation string.
   *
   * The notation is parsed against the registered unit definitions in
   * {@link ./unit-definitions}. SI prefixes are applied automatically when
   * the bare notation doesn't match a registered unit. Compound expressions
   * like `"m/s²"`, `"kg·m/s²"`, and `"1/s"` are supported.
   *
   * @throws {UnitParseError} if `notation` cannot be parsed against the
   *   registered unit definitions.
   */
  constructor(value: number, notation: string);
  /**
   * Internal construction shortcut from already-canonical fields. **Not
   * intended for direct use** — most callers should use the `(value,
   * notation)` form.
   */
  constructor(value: number, dimensions: Readonly<Dimensions>, notation: string);
  constructor(value: number, notationOrDims: string | Readonly<Dimensions>, notation?: string) {
    if (typeof notationOrDims === 'string') {
      const parsed = parse(notationOrDims);
      const composed = composeAtoms(parsed.atoms);
      const inputValue = parsed.scalar * value;

      // Apply temperature offset only if this is a single-atom unit with
      // exponent 1 that has an offset. (We don't apply offsets to
      // composite units; they only make sense when used alone.)
      let canonical: number;
      if (parsed.atoms.length === 1 && parsed.atoms[0].exponent === 1) {
        const a = parsed.atoms[0];
        canonical = inputValue * a.multiplier + a.offset;
      } else {
        canonical = inputValue * composed.multiplier;
      }

      this.value = canonical;
      this.dimensions = composed.dimensions;
      this.notation = notationOrDims;
    } else {
      this.value = value;
      this.dimensions = notationOrDims;
      this.notation = notation ?? '';
    }
  }

  // -------------------------------------------------------------------------
  // Arithmetic
  // -------------------------------------------------------------------------

  /**
   * Add two units. Requires identical dimensions.
   *
   * @throws {DimensionMismatchError} if dimensions differ.
   */
  add(other: Unit): Unit {
    if (!dimsEqual(this.dimensions, other.dimensions)) {
      throw new DimensionMismatchError(this.dimensions, other.dimensions, 'add');
    }
    return new Unit(this.value + other.value, this.dimensions, this.notation);
  }

  /**
   * Subtract two units. Requires identical dimensions.
   *
   * @throws {DimensionMismatchError} if dimensions differ.
   */
  sub(other: Unit): Unit {
    if (!dimsEqual(this.dimensions, other.dimensions)) {
      throw new DimensionMismatchError(this.dimensions, other.dimensions, 'sub');
    }
    return new Unit(this.value - other.value, this.dimensions, this.notation);
  }

  /**
   * Multiply by another unit or a scalar. Dimensions add when multiplying by
   * another unit; unchanged when multiplying by a scalar.
   */
  mul(other: Unit | number): Unit {
    if (typeof other === 'number') {
      return new Unit(this.value * other, this.dimensions, this.notation);
    }
    return new Unit(
      this.value * other.value,
      dimsAdd(this.dimensions, other.dimensions),
      composeNotation(this.notation, other.notation, '*')
    );
  }

  /**
   * Divide by another unit or a scalar. Dimensions subtract when dividing by
   * another unit; unchanged when dividing by a scalar.
   */
  div(other: Unit | number): Unit {
    if (typeof other === 'number') {
      return new Unit(this.value / other, this.dimensions, this.notation);
    }
    return new Unit(
      this.value / other.value,
      dimsSub(this.dimensions, other.dimensions),
      composeNotation(this.notation, other.notation, '/')
    );
  }

  /**
   * Raise to an integer or rational power. Dimensions scale by `n`.
   */
  pow(n: number): Unit {
    return new Unit(
      this.value ** n,
      dimsScale(this.dimensions, n),
      this.notation ? `(${this.notation})^${n}` : ''
    );
  }

  // -------------------------------------------------------------------------
  // Conversion
  // -------------------------------------------------------------------------

  /**
   * Convert to a target unit. Dimensions must match.
   *
   * @throws {DimensionMismatchError} if `targetNotation`'s dimensions differ
   *   from this unit's.
   */
  to(targetNotation: string): Unit {
    const parsed = parse(targetNotation);
    const composed = composeAtoms(parsed.atoms);

    if (!dimsEqual(this.dimensions, composed.dimensions)) {
      throw new DimensionMismatchError(
        this.dimensions,
        composed.dimensions,
        `to("${targetNotation}")`
      );
    }

    // The canonical (SI-base) value never changes during a conversion — only
    // the *labelled* notation does. `toString()` will re-derive the displayed
    // magnitude from `value` and `notation`. We use the internal (dims,
    // notation) constructor overload so we don't re-parse the leading scalar.
    return new Unit(this.value, composed.dimensions, targetNotation);
  }

  /**
   * Pick a unit (with SI prefix) that gives a magnitude closest to 1.
   *
   * Searches the unit registry for entries matching this unit's dimensions,
   * then applies each SI prefix in {@link BEST_PREFIXES} to find the
   * representation minimising `|log10(displayed value)|`.
   *
   * If no registered unit matches the dimensions, falls back to a synthetic
   * notation describing the dimensional vector.
   */
  toBest(): Unit {
    // Dimensionless? Return as-is with no unit.
    if (isDimensionless(this.dimensions)) {
      return new Unit(this.value, this.dimensions, '');
    }

    let bestNotation: string | undefined;
    let bestScore = Infinity;

    for (const [name, def] of Object.entries(ALL_UNITS)) {
      // Skip mass kg base (we have "g" with prefixes covering this dim).
      if (name === 'kg') continue;
      if (!dimsEqual(def.dimensions, this.dimensions)) continue;
      if (def.offset !== undefined) continue; // Skip non-multiplicative for toBest.

      const candidatePrefixes = def.prefixable ? BEST_PREFIXES : [''];
      for (const prefix of candidatePrefixes) {
        const factor = prefix === '' ? def.multiplier : def.multiplier * SI_PREFIXES[prefix];
        if (factor === 0) continue;
        const displayed = this.value / factor;
        if (displayed === 0) continue;
        const score = Math.abs(Math.log10(Math.abs(displayed)));
        if (score < bestScore) {
          bestScore = score;
          bestNotation = prefix + name;
        }
      }
    }

    if (bestNotation === undefined) {
      // No matching named unit; preserve current state.
      return new Unit(
        this.value,
        this.dimensions,
        this.notation || formatDimensions(this.dimensions)
      );
    }
    // Preserve canonical value; only relabel the notation. `toString()`
    // re-derives the displayed magnitude.
    return new Unit(this.value, this.dimensions, bestNotation);
  }

  // -------------------------------------------------------------------------
  // Comparison
  // -------------------------------------------------------------------------

  /** True iff dimensions and canonical value are equal. */
  equals(other: Unit): boolean {
    return dimsEqual(this.dimensions, other.dimensions) && this.value === other.value;
  }

  /** True iff dimensions match (values may differ). */
  dimensionsEqual(other: Unit): boolean {
    return dimsEqual(this.dimensions, other.dimensions);
  }

  // -------------------------------------------------------------------------
  // Formatting
  // -------------------------------------------------------------------------

  /**
   * Pretty-print. If `notation` is set (the common case), display the value
   * in that notation — otherwise emit a dimensional signature.
   */
  toString(): string {
    if (this.notation === '') {
      if (isDimensionless(this.dimensions)) return String(this.value);
      return `${this.value} ${formatDimensions(this.dimensions)}`;
    }

    // Re-compute the displayed magnitude for this notation.
    const displayed = displayedValue(this.value, this.notation);
    return `${formatNumber(displayed)} ${this.notation}`;
  }

  /** JSON-serialisable record. */
  toJSON(): { mathts: 'Unit'; value: number; notation: string } {
    return { mathts: 'Unit', value: this.value, notation: this.notation };
  }

  /**
   * Rehydrate from a JSON record produced by {@link toJSON}.
   *
   * @throws {UnitParseError} if `json.notation` cannot be parsed.
   */
  static fromJSON(json: { value: number; notation: string }): Unit {
    // Reconstruct *without* re-running parse on the value, since the stored
    // value is already canonical.
    const parsed = parse(json.notation);
    const composed = composeAtoms(parsed.atoms);
    return new Unit(json.value, composed.dimensions, json.notation);
  }

  /**
   * Parse a full unit expression (with optional leading numeric coefficient).
   *
   * Example: `Unit.parse('5 km/h')`.
   */
  static parse(input: string): Unit {
    const { scalar, rest } = splitScalar(input);
    return new Unit(scalar, rest);
  }
}

// Tag the prototype for backwards-compat with the duck-typing `isUnit()`
// guard in `core/src/is.ts` that looks at `constructor.prototype.isUnit`.
// Cast through `unknown` so the prototype-property assignment doesn't
// trigger `@typescript-eslint/no-explicit-any`.
(Unit.prototype as unknown as { isUnit: boolean }).isUnit = true;

// ---------------------------------------------------------------------------
// Helpers used by the constructor / methods
// ---------------------------------------------------------------------------

/**
 * Multiplicatively compose a list of atom terms into a single (multiplier,
 * dimensions) pair. Offsets are deliberately *not* composed — they only make
 * sense for single-atom, exponent-1 units.
 */
function composeAtoms(atoms: AtomTerm[]): { multiplier: number; dimensions: Dimensions } {
  let multiplier = 1;
  let dimensions: Dimensions = { ...DIMENSIONLESS };
  for (const a of atoms) {
    multiplier *= a.multiplier ** a.exponent;
    dimensions = dimsAdd(dimensions, dimsScale(a.dimensions, a.exponent));
  }
  return { multiplier, dimensions };
}

/**
 * Display-value computation: given a canonical value and a target notation,
 * return the magnitude that should be shown alongside that notation.
 */
function displayedValue(canonical: number, notation: string): number {
  const parsed = parse(notation);
  const composed = composeAtoms(parsed.atoms);
  if (parsed.atoms.length === 1 && parsed.atoms[0].exponent === 1) {
    const a = parsed.atoms[0];
    return (canonical - a.offset) / a.multiplier;
  }
  return canonical / composed.multiplier;
}

/**
 * Lightweight number formatting used by `toString()`. Avoids the noise of
 * JS's default `toString()` for floats. Caller-side formatting (precision,
 * locale) is out of scope here; consumers needing more control should read
 * `.value` directly.
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Round to ~12 significant digits to elide floating-point noise.
  const rounded = Number(n.toPrecision(12));
  return rounded.toString();
}

/**
 * Compose two notation strings under an operator, parenthesising as needed.
 */
function composeNotation(a: string, b: string, op: '*' | '/'): string {
  if (a === '' && b === '') return '';
  if (a === '') return op === '*' ? b : `1/${b}`;
  if (b === '') return a;
  const sep = op === '*' ? '*' : '/';
  return `${a}${sep}${b}`;
}

// ---------------------------------------------------------------------------
// Re-exports for ergonomic top-level use
// ---------------------------------------------------------------------------

export type { Dimensions, UnitDef };
export { DIMENSIONLESS, dim };

/**
 * Duck-typing guard for {@link Unit}. Mirrors the convention used by
 * {@link Complex}, {@link Fraction}, and {@link BigNumber}.
 */
export function isUnit(value: unknown): value is Unit {
  return value instanceof Unit;
}
