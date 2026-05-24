/**
 * Index — an immutable value type carrying a unique identity, a dimension,
 * optional tags, and a prime level. Two indices *match* (and will be
 * contracted by `Tensor.contract`) iff their `id` and `primeLevel` agree.
 * Dimension agreement is validated at contraction time, not at matching time.
 *
 * Inspired by ITensors.jl's `Index` primitive.
 */

export interface IndexOpts {
  /** Human-readable name; not used for matching but useful in errors / debug. */
  name?: string;
  /**
   * Free-form tag list. Two indices with the SAME id but DIFFERENT tags still
   * match by id.
   */
  tags?: ReadonlyArray<string>;
  /**
   * Prime level (ITensor's "prime"). Two indices with the same id but different
   * prime levels do NOT match.
   */
  primeLevel?: number;
}

/**
 * A first-class index value. Each `new Index(...)` call mints a fresh `id`
 * (Symbol) that can never collide with another. Methods that would mutate
 * state instead return a new `Index` sharing the same `id`.
 */
export class Index {
  readonly id: symbol;
  readonly dim: number;
  readonly name?: string;
  readonly tags: ReadonlyArray<string>;
  readonly primeLevel: number;

  constructor(dim: number, opts?: IndexOpts) {
    if (!Number.isInteger(dim) || dim < 1) {
      throw new Error(`Index: dim must be a positive integer, got ${dim}`);
    }
    this.id = Symbol(opts?.name ?? '');
    this.dim = dim;
    this.name = opts?.name;
    this.tags = opts?.tags ? [...opts.tags] : [];
    this.primeLevel = opts?.primeLevel ?? 0;
  }

  /**
   * Internal constructor used by mutating-style methods that need to share the
   * same `id` with a different primeLevel / tags. Not exposed publicly.
   */
  private static _from(
    id: symbol,
    dim: number,
    name: string | undefined,
    tags: ReadonlyArray<string>,
    primeLevel: number
  ): Index {
    const ix = Object.create(Index.prototype) as Index;
    (ix as { id: symbol }).id = id;
    (ix as { dim: number }).dim = dim;
    (ix as { name?: string }).name = name;
    (ix as { tags: ReadonlyArray<string> }).tags = [...tags];
    (ix as { primeLevel: number }).primeLevel = primeLevel;
    return ix;
  }

  /**
   * Return a new Index with `primeLevel` incremented by `by` (default 1).
   */
  prime(by = 1): Index {
    if (!Number.isInteger(by) || by < 1) {
      throw new Error(`Index.prime: 'by' must be a positive integer, got ${by}`);
    }
    return Index._from(this.id, this.dim, this.name, this.tags, this.primeLevel + by);
  }

  /**
   * Return a new Index with `primeLevel` reset to 0.
   */
  noprime(): Index {
    return Index._from(this.id, this.dim, this.name, this.tags, 0);
  }

  /**
   * Return a new Index with `tag` added to its tag list (no-op if already present).
   */
  addTag(tag: string): Index {
    if (this.tags.includes(tag)) return this;
    return Index._from(this.id, this.dim, this.name, [...this.tags, tag], this.primeLevel);
  }

  /**
   * Return a new Index with `tag` removed from its tag list (no-op if absent).
   */
  removeTag(tag: string): Index {
    const next = this.tags.filter((t) => t !== tag);
    if (next.length === this.tags.length) return this;
    return Index._from(this.id, this.dim, this.name, next, this.primeLevel);
  }

  /**
   * True if `tag` is in this index's tag list.
   */
  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  /**
   * Two indices match iff they share the same `id` AND the same `primeLevel`.
   * Dimension is NOT used for matching — it is validated at contraction time.
   */
  matches(other: Index): boolean {
    return this.id === other.id && this.primeLevel === other.primeLevel;
  }

  toString(): string {
    const primeStr = this.primeLevel > 0 ? `'`.repeat(this.primeLevel) : '';
    const nameStr = this.name ?? this.id.toString();
    const tagStr = this.tags.length > 0 ? ` [${this.tags.join(',')}]` : '';
    return `Index(${nameStr}${primeStr}, dim=${this.dim}${tagStr})`;
  }
}

/**
 * Convenience factory: `const i = idx(3, 'i')`.
 *
 * ```ts
 * const i = idx(3, 'i');            // dim=3, name='i', primeLevel=0
 * const j = idx(4, 'j', { tags: ['site'] });
 * ```
 */
export function idx(dim: number, name?: string, opts?: Omit<IndexOpts, 'name'>): Index {
  return new Index(dim, { name, ...opts });
}
