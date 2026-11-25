/**
 * The `ResultSet` a block of statements returns.
 *
 * The single canonical class for the whole monorepo (#1567): the compiler's
 * block node, the parse defaults and typed-API callers all share this identity,
 * so `instanceof ResultSet` holds against the package export wherever a block
 * was evaluated. It has the shape of the `ResultSet` type in `utils/is.ts`.
 *
 * @packageDocumentation
 */

/** JSON representation of a ResultSet. */
export interface ResultSetJSON {
  mathjs: 'ResultSet';
  entries: unknown[];
}

/** The class `new ResultSet(entries)` builds. */
export class ResultSet {
  entries: unknown[];

  constructor(entries?: unknown[]) {
    this.entries = entries ?? [];
  }

  /** The type guard `isResultSet` reads this from the constructor prototype. */
  get isResultSet(): true {
    return true;
  }

  get type(): 'ResultSet' {
    return 'ResultSet';
  }

  /** The array with the results held by this ResultSet. */
  valueOf(): unknown[] {
    return this.entries;
  }

  toString(): string {
    return '[' + this.entries.map(String).join(', ') + ']';
  }

  toJSON(): ResultSetJSON {
    return { mathjs: 'ResultSet', entries: this.entries };
  }

  static fromJSON(json: ResultSetJSON): ResultSet {
    return new ResultSet(json.entries);
  }
}
