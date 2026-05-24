/**
 * contractNetwork — given an ordered list of Tensors (each carrying
 * `axisLabels`), find the pairwise-contraction order minimising the total
 * FLOP count and execute it. ITensor's `optimal_contraction_sequence`
 * equivalent.
 *
 * Two algorithms are provided:
 *
 *   - 'exact' — bitmask dynamic programming. For every non-empty subset
 *     S ⊂ {0..N-1} of input tensors, we compute `bestCost[S]` and the
 *     partition (S₁, S₂) achieving it (S = S₁ ⊔ S₂, both non-empty).
 *     Transition:
 *
 *         bestCost[S] = min over all proper subset pairs (S₁, S₂) of
 *                       bestCost[S₁] + bestCost[S₂] + pairwiseCost(net(S₁), net(S₂))
 *
 *     Base: bestCost[{i}] = 0. Subset enumeration via the standard
 *     submask trick `for (sub = (mask-1) & mask; sub > 0; sub = (sub-1) & mask)`
 *     visits every non-empty proper subset in O(3^N) total.
 *
 *     Determinism: ties broken by preferring the lexicographically smaller
 *     (subsetMask₁, subsetMask₂) where subsetMask₁ ≤ subsetMask₂.
 *
 *     Bitmask encoding: bit `i` of a 32-bit integer is set iff input tensor
 *     index `i` is part of the subset. So `0b1011 = {0, 1, 3}`. We use
 *     ordinary JavaScript numbers (safe up to 2^32 for bitwise ops; capped
 *     at N ≤ 30 for headroom).
 *
 *   - 'greedy' — Hendrickson–Sundaram. Maintain a working list of
 *     intermediate tensor shapes. At each step, choose the pair (i, j) with
 *     the cheapest pairwise contraction cost and replace them with their
 *     contraction. Repeat until one remains. O(N³) per step × O(N) steps.
 *
 * Cost model: for a pairwise contraction of two intermediate tensors with
 * shared-axis dimension product `D_shared` and free-axis dimension products
 * `D_free_left`, `D_free_right`, the contraction FLOP cost is
 *
 *     cost = D_shared * D_free_left * D_free_right
 *
 * which is the volume of the OUTPUT tensor times the contraction depth. If
 * `D_shared = 1` (no shared axes — outer product) we use `D_free_left *
 * D_free_right`; mathematically that is the same formula. We follow this
 * convention but it never fires in practice because we drive the cost
 * through pairs with at least one shared index when possible.
 *
 * Output-tensor size for `intermediateSizes`: `D_free_left * D_free_right`
 * (the contracted-axis dimensions are summed away, not multiplied into the
 * result).
 *
 * `contractionOrder` indexing convention: each pair `[i, j]` is in
 * "virtual-index" space. Input tensors occupy slots 0..N-1; the first
 * pairwise contraction produces virtual slot N, the second slot N+1, and
 * so on. So a length-N input network has a length-(N-1) order array.
 */

import { Tensor } from './Tensor.js';
import { Index } from './named-index.js';

export interface ContractNetworkOpts {
  /** Cap intermediate-tensor element count to avoid blowups. Default: 2^31. */
  maxIntermediateSize?: number;
  /**
   * 'exact'  = DP optimal (≤ ~16 tensors, slow beyond that).
   * 'greedy' = Hendrickson–Sundaram heuristic (any N).
   * 'auto'   = 'exact' when N ≤ 16, otherwise 'greedy'.
   * Default: 'auto'.
   */
  algorithm?: 'exact' | 'greedy' | 'auto';
}

export interface ContractNetworkResult {
  result: Tensor;
  /** Pairwise contractions in (virtual) input-index space; see file header. */
  contractionOrder: ReadonlyArray<readonly [number, number]>;
  /** Sum of pairwise FLOP costs along the chosen order. */
  totalFlops: number;
  /** Element count of each intermediate, in creation order. */
  intermediateSizes: ReadonlyArray<number>;
}

/**
 * A symbolic intermediate shape: the list of free (uncontracted) Indices
 * carried by an in-flight intermediate tensor. Pairwise contraction is
 * fully determined by the set of shared Indices (matched by `Index.matches`).
 */
interface VirtualShape {
  readonly indices: ReadonlyArray<Index>;
}

/**
 * Pairwise contraction cost + the resulting VirtualShape. Cost is
 * `D_shared * D_free_left * D_free_right`; result is the union of the two
 * input shapes with shared indices removed.
 */
interface PairwiseStep {
  readonly cost: number;
  readonly resultShape: VirtualShape;
  readonly resultSize: number;
}

function pairwise(a: VirtualShape, b: VirtualShape): PairwiseStep {
  // Identify which indices of `a` and `b` are shared (matched by id+primeLevel).
  const aIsShared = new Array<boolean>(a.indices.length).fill(false);
  const bIsShared = new Array<boolean>(b.indices.length).fill(false);
  let dShared = 1;
  for (let i = 0; i < a.indices.length; i++) {
    for (let j = 0; j < b.indices.length; j++) {
      if (bIsShared[j]) continue;
      if (a.indices[i].matches(b.indices[j])) {
        aIsShared[i] = true;
        bIsShared[j] = true;
        dShared *= a.indices[i].dim;
        break;
      }
    }
  }
  let dFreeLeft = 1;
  const free: Index[] = [];
  for (let i = 0; i < a.indices.length; i++) {
    if (!aIsShared[i]) {
      dFreeLeft *= a.indices[i].dim;
      free.push(a.indices[i]);
    }
  }
  let dFreeRight = 1;
  for (let j = 0; j < b.indices.length; j++) {
    if (!bIsShared[j]) {
      dFreeRight *= b.indices[j].dim;
      free.push(b.indices[j]);
    }
  }
  const cost = dShared * dFreeLeft * dFreeRight;
  const resultSize = dFreeLeft * dFreeRight;
  return { cost, resultShape: { indices: free }, resultSize };
}

/**
 * "Net" shape of a subset S of input tensors: the indices that remain free
 * after contracting all pairs whose indices match WITHIN S. Independent of
 * the contraction order — only depends on the set of inputs.
 *
 * Algorithm: concatenate all axis labels of tensors in S; any Index that
 * appears exactly once survives as a free axis. (We rely on the network
 * being well-formed: an Index appearing more than twice is unusual and
 * would still be contracted away by repeated pairwise reductions; we treat
 * counts ≥ 2 as "fully contracted" and counts of 1 as "free". This matches
 * ITensor's behaviour.)
 */
function netShape(shapes: ReadonlyArray<VirtualShape>): VirtualShape {
  // For each Index encountered, track count + the Index itself.
  // Two Indices "match" via `Index.matches`; we group by linear scan since
  // the typical axis count per intermediate is small.
  const seen: Array<{ index: Index; count: number }> = [];
  for (const sh of shapes) {
    for (const ix of sh.indices) {
      let found = false;
      for (const entry of seen) {
        if (entry.index.matches(ix)) {
          entry.count++;
          found = true;
          break;
        }
      }
      if (!found) seen.push({ index: ix, count: 1 });
    }
  }
  return { indices: seen.filter((e) => e.count === 1).map((e) => e.index) };
}

/**
 * Validate inputs and extract their virtual shapes (axisLabels).
 */
function extractShapes(tensors: ReadonlyArray<Tensor>): VirtualShape[] {
  const shapes: VirtualShape[] = [];
  for (let i = 0; i < tensors.length; i++) {
    const t = tensors[i];
    if (t.axisLabels === undefined) {
      throw new Error(`contractNetwork: tensor at index ${i} lacks axisLabels`);
    }
    shapes.push({ indices: t.axisLabels });
  }
  return shapes;
}

// ---------------------------------------------------------------------------
// Exact (bitmask DP) solver
// ---------------------------------------------------------------------------

interface DPEntry {
  /** Total cost to reduce this subset to a single intermediate. */
  cost: number;
  /** Partition (s1, s2) that achieves the optimum; s1 < s2 by mask comparison. */
  split: readonly [number, number] | null;
}

interface PlanStep {
  /** Pair of virtual-tensor indices (in the contractionOrder sense). */
  pair: readonly [number, number];
  /** Cost of THIS pairwise step. */
  cost: number;
  /** Element count of the produced intermediate. */
  resultSize: number;
}

/**
 * Build a "canonical index table" over the network. For each unique
 * (Index.id, primeLevel) pair appearing in any input tensor, assign a small
 * integer id. The "shape" of a subset of inputs becomes a bigint bitmask over
 * those ids (a bit set iff that index appears as a free axis of the subset).
 *
 * Critically: when each Index appears in ≤ 2 input tensors (the typical
 * network), the subset's free-axis bitmask is the XOR of its members'
 * own-axis bitmasks. Indices appearing more than twice fall back to a slow
 * path that counts occurrences.
 *
 * This turns `pairwise` from O(|A|·|B|) Index-array scans into a few bigint
 * operations + a quick popcount loop, which is the difference between a
 * 16-tensor DP that runs in a few seconds vs ~20 seconds.
 */
interface CanonicalIndexTable {
  /** dimsByKey[k] = dim of the unique index k. */
  readonly dimsByKey: ReadonlyArray<number>;
  /**
   * Bitmask of free axes for each input tensor. When the unique-index count
   * is ≤ 30, we store as 32-bit numbers (`perInputMaskLo`, `Hi` is 0); when
   * it's between 31 and 60 we use a low+high split. Networks with > 60
   * unique indices fall through to the slow `solveExactSlow` path.
   */
  readonly perInputMaskLo: ReadonlyArray<number>;
  readonly perInputMaskHi: ReadonlyArray<number>;
  /** Whether every index appears ≤ 2 times (XOR path is valid). */
  readonly xorSafe: boolean;
  /** Number of unique (id, primeLevel) pairs across the network. */
  readonly uniqueIndexCount: number;
}

function buildCanonicalTable(shapes: ReadonlyArray<VirtualShape>): CanonicalIndexTable {
  // Assign a small-integer key to each unique (id, primeLevel) pair.
  const keyByIndex: Array<{ index: Index; key: number }> = [];
  const dimsByKey: number[] = [];
  const globalCount: number[] = [];
  const perInputMaskLo: number[] = [];
  const perInputMaskHi: number[] = [];

  const lookupOrInsert = (ix: Index): number => {
    for (const entry of keyByIndex) {
      if (entry.index.matches(ix)) return entry.key;
    }
    const newKey = dimsByKey.length;
    dimsByKey.push(ix.dim);
    globalCount.push(0);
    keyByIndex.push({ index: ix, key: newKey });
    return newKey;
  };

  for (const sh of shapes) {
    let maskLo = 0;
    let maskHi = 0;
    for (const ix of sh.indices) {
      const key = lookupOrInsert(ix);
      if (key < 30) {
        maskLo |= 1 << key;
      } else {
        maskHi |= 1 << (key - 30);
      }
      globalCount[key]++;
    }
    perInputMaskLo.push(maskLo);
    perInputMaskHi.push(maskHi);
  }

  const xorSafe = globalCount.every((c) => c <= 2);

  return {
    dimsByKey,
    perInputMaskLo,
    perInputMaskHi,
    xorSafe,
    uniqueIndexCount: dimsByKey.length,
  };
}

/**
 * Build the DP table and recover the optimal contraction plan.
 *
 * Returns null when no valid order exists under `maxIntermediateSize`.
 *
 * Subset bitmask encoding: bit `i` of a number (0 ≤ i < N) is set iff input
 * tensor `i` is part of the subset. So `0b1011 = {0, 1, 3}`. JS numbers safely
 * represent 32-bit bitwise ops; we cap at N ≤ 30 for headroom.
 */
function solveExact(
  shapes: ReadonlyArray<VirtualShape>,
  maxIntermediateSize: number
): { steps: ReadonlyArray<PlanStep> } | null {
  const N = shapes.length;
  if (N > 30) {
    throw new Error(
      `contractNetwork (exact): N=${N} exceeds bitmask cap of 30; use algorithm: 'greedy'`
    );
  }

  const table = buildCanonicalTable(shapes);
  // Fall back to the slow Index-array `pairwise` path if (a) any Index appears
  // more than twice (the XOR-of-masks trick would lose count information), or
  // (b) the unique index count exceeds 60 (won't fit in our two 30-bit halves).
  if (!table.xorSafe || table.uniqueIndexCount > 60) {
    return solveExactSlow(shapes, maxIntermediateSize);
  }

  const dims = table.dimsByKey;
  const dp = new Array<DPEntry | undefined>(1 << N);
  // Mask of free indices for the subset, split into two 30-bit halves so
  // bitwise ops stay in the 32-bit fast path.
  const maskLoOf = new Int32Array(1 << N);
  const maskHiOf = new Int32Array(1 << N);
  for (let i = 0; i < N; i++) {
    const single = 1 << i;
    dp[single] = { cost: 0, split: null };
    maskLoOf[single] = table.perInputMaskLo[i];
    maskHiOf[single] = table.perInputMaskHi[i];
  }

  const full = (1 << N) - 1;
  // Pre-bucket masks by popcount.
  const masksByPopcount: number[][] = [];
  for (let k = 0; k <= N; k++) masksByPopcount.push([]);
  for (let mask = 1; mask <= full; mask++) {
    let pc = 0;
    for (let m = mask; m > 0; m &= m - 1) pc++;
    masksByPopcount[pc].push(mask);
  }

  for (let pc = 2; pc <= N; pc++) {
    const buckets = masksByPopcount[pc];
    for (let bi = 0; bi < buckets.length; bi++) {
      const mask = buckets[bi];
      let bestCost = Infinity;
      let bestS1 = -1;
      let bestS2 = -1;
      let bestMaskLo = 0;
      let bestMaskHi = 0;

      // Standard submask enumeration; canonicalised sub ≤ comp.
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const comp = mask ^ sub;
        if (sub > comp) continue;

        const left = dp[sub];
        const right = dp[comp];
        if (!left || !right) continue;

        const lLo = maskLoOf[sub];
        const lHi = maskHiOf[sub];
        const rLo = maskLoOf[comp];
        const rHi = maskHiOf[comp];
        const sharedLo = lLo & rLo;
        const sharedHi = lHi & rHi;
        const leftOnlyLo = lLo & ~rLo;
        const leftOnlyHi = lHi & ~rHi;
        const rightOnlyLo = rLo & ~lLo;
        const rightOnlyHi = rHi & ~lHi;

        // Inline product-of-dims-at-set-bits for each of shared / left / right.
        let dShared = 1;
        let m1 = sharedLo;
        while (m1 !== 0) {
          const lsb = m1 & -m1;
          dShared *= dims[31 - Math.clz32(lsb)];
          m1 ^= lsb;
        }
        let m2 = sharedHi;
        while (m2 !== 0) {
          const lsb = m2 & -m2;
          dShared *= dims[30 + 31 - Math.clz32(lsb)];
          m2 ^= lsb;
        }
        let dFreeLeft = 1;
        m1 = leftOnlyLo;
        while (m1 !== 0) {
          const lsb = m1 & -m1;
          dFreeLeft *= dims[31 - Math.clz32(lsb)];
          m1 ^= lsb;
        }
        m2 = leftOnlyHi;
        while (m2 !== 0) {
          const lsb = m2 & -m2;
          dFreeLeft *= dims[30 + 31 - Math.clz32(lsb)];
          m2 ^= lsb;
        }
        let dFreeRight = 1;
        m1 = rightOnlyLo;
        while (m1 !== 0) {
          const lsb = m1 & -m1;
          dFreeRight *= dims[31 - Math.clz32(lsb)];
          m1 ^= lsb;
        }
        m2 = rightOnlyHi;
        while (m2 !== 0) {
          const lsb = m2 & -m2;
          dFreeRight *= dims[30 + 31 - Math.clz32(lsb)];
          m2 ^= lsb;
        }
        const stepCost = dShared * dFreeLeft * dFreeRight;
        const stepResultSize = dFreeLeft * dFreeRight;
        if (stepResultSize > maxIntermediateSize) continue;

        const total = left.cost + right.cost + stepCost;
        const better =
          total < bestCost ||
          (total === bestCost && (sub < bestS1 || (sub === bestS1 && comp < bestS2)));
        if (better) {
          bestCost = total;
          bestS1 = sub;
          bestS2 = comp;
          bestMaskLo = lLo ^ rLo;
          bestMaskHi = lHi ^ rHi;
        }
      }

      if (bestS1 !== -1) {
        dp[mask] = { cost: bestCost, split: [bestS1, bestS2] as const };
        maskLoOf[mask] = bestMaskLo;
        maskHiOf[mask] = bestMaskHi;
      }
    }
  }

  const root = dp[full];
  if (!root) return null;

  // Walk the optimal partition tree → flat sequence of pairwise contractions.
  const steps: PlanStep[] = [];
  const slotFor = new Map<number, number>();
  for (let i = 0; i < N; i++) slotFor.set(1 << i, i);
  let nextSlot = N;

  // Recompute the per-step cost + result-size on the recovery walk.
  const stepFor = (s1: number, s2: number): { cost: number; resultSize: number } => {
    const lLo = maskLoOf[s1];
    const lHi = maskHiOf[s1];
    const rLo = maskLoOf[s2];
    const rHi = maskHiOf[s2];
    const sharedLo = lLo & rLo;
    const sharedHi = lHi & rHi;
    const leftOnlyLo = lLo & ~rLo;
    const leftOnlyHi = lHi & ~rHi;
    const rightOnlyLo = rLo & ~lLo;
    const rightOnlyHi = rHi & ~lHi;
    let dShared = 1;
    for (let m = sharedLo; m !== 0; ) {
      const lsb = m & -m;
      dShared *= dims[31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    for (let m = sharedHi; m !== 0; ) {
      const lsb = m & -m;
      dShared *= dims[30 + 31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    let dFL = 1;
    for (let m = leftOnlyLo; m !== 0; ) {
      const lsb = m & -m;
      dFL *= dims[31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    for (let m = leftOnlyHi; m !== 0; ) {
      const lsb = m & -m;
      dFL *= dims[30 + 31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    let dFR = 1;
    for (let m = rightOnlyLo; m !== 0; ) {
      const lsb = m & -m;
      dFR *= dims[31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    for (let m = rightOnlyHi; m !== 0; ) {
      const lsb = m & -m;
      dFR *= dims[30 + 31 - Math.clz32(lsb)];
      m ^= lsb;
    }
    return { cost: dShared * dFL * dFR, resultSize: dFL * dFR };
  };

  type Frame = { mask: number; visited: boolean };
  const stack: Frame[] = [{ mask: full, visited: false }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.visited) {
      stack.pop();
      if (slotFor.has(frame.mask)) continue;
      const entry = dp[frame.mask]!;
      const [s1, s2] = entry.split!;
      const step = stepFor(s1, s2);
      const slot1 = slotFor.get(s1)!;
      const slot2 = slotFor.get(s2)!;
      const orderedPair: readonly [number, number] =
        slot1 <= slot2 ? [slot1, slot2] : [slot2, slot1];
      steps.push({ pair: orderedPair, cost: step.cost, resultSize: step.resultSize });
      slotFor.set(frame.mask, nextSlot++);
      continue;
    }
    frame.visited = true;
    if (slotFor.has(frame.mask)) continue;
    const entry = dp[frame.mask]!;
    if (!entry.split) continue;
    const [s1, s2] = entry.split;
    stack.push({ mask: s2, visited: false });
    stack.push({ mask: s1, visited: false });
  }

  return { steps };
}

/**
 * Slow-path DP using the Index-array `pairwise` (for rare networks where an
 * index appears more than twice and the XOR-of-masks trick is invalid).
 */
interface DPSlowEntry {
  cost: number;
  split: readonly [number, number] | null;
  shape: VirtualShape;
}

function solveExactSlow(
  shapes: ReadonlyArray<VirtualShape>,
  maxIntermediateSize: number
): { steps: ReadonlyArray<PlanStep> } | null {
  const N = shapes.length;
  const dp = new Map<number, DPSlowEntry>();
  for (let i = 0; i < N; i++) {
    dp.set(1 << i, { cost: 0, split: null, shape: shapes[i] });
  }

  const full = (1 << N) - 1;
  const masksByPopcount: number[][] = [];
  for (let k = 0; k <= N; k++) masksByPopcount.push([]);
  for (let mask = 1; mask <= full; mask++) {
    let pc = 0;
    for (let m = mask; m > 0; m &= m - 1) pc++;
    masksByPopcount[pc].push(mask);
  }

  for (let pc = 2; pc <= N; pc++) {
    for (const mask of masksByPopcount[pc]) {
      let best: { cost: number; split: readonly [number, number]; shape: VirtualShape } | null =
        null;
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        const comp = mask ^ sub;
        if (sub > comp) continue;
        const left = dp.get(sub);
        const right = dp.get(comp);
        if (!left || !right) continue;
        const step = pairwise(left.shape, right.shape);
        if (step.resultSize > maxIntermediateSize) continue;
        const total = left.cost + right.cost + step.cost;
        if (
          best === null ||
          total < best.cost ||
          (total === best.cost && tieBreakBetter(sub, comp, best.split))
        ) {
          best = { cost: total, split: [sub, comp] as const, shape: step.resultShape };
        }
      }
      if (best !== null) {
        dp.set(mask, { cost: best.cost, split: best.split, shape: best.shape });
      }
    }
  }

  const root = dp.get(full);
  if (!root) return null;

  const steps: PlanStep[] = [];
  const slotFor = new Map<number, number>();
  for (let i = 0; i < N; i++) slotFor.set(1 << i, i);
  let nextSlot = N;

  type Frame = { mask: number; visited: boolean };
  const stack: Frame[] = [{ mask: full, visited: false }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.visited) {
      stack.pop();
      if (slotFor.has(frame.mask)) continue;
      const entry = dp.get(frame.mask)!;
      const [s1, s2] = entry.split!;
      const left = dp.get(s1)!;
      const right = dp.get(s2)!;
      const step = pairwise(left.shape, right.shape);
      const slot1 = slotFor.get(s1)!;
      const slot2 = slotFor.get(s2)!;
      const orderedPair: readonly [number, number] =
        slot1 <= slot2 ? [slot1, slot2] : [slot2, slot1];
      steps.push({ pair: orderedPair, cost: step.cost, resultSize: step.resultSize });
      slotFor.set(frame.mask, nextSlot++);
      continue;
    }
    frame.visited = true;
    if (slotFor.has(frame.mask)) continue;
    const entry = dp.get(frame.mask)!;
    if (!entry.split) continue;
    const [s1, s2] = entry.split;
    stack.push({ mask: s2, visited: false });
    stack.push({ mask: s1, visited: false });
  }

  return { steps };
}

/**
 * Tie-break helper: prefer (a, b) lexicographically smaller than the
 * existing best split (assumed canonical: a ≤ b in both).
 */
function tieBreakBetter(
  a: number,
  b: number,
  prev: readonly [number, number] | null | undefined
): boolean {
  if (!prev) return true;
  if (a < prev[0]) return true;
  if (a > prev[0]) return false;
  return b < prev[1];
}

// ---------------------------------------------------------------------------
// Greedy (Hendrickson–Sundaram) solver
// ---------------------------------------------------------------------------

/**
 * Greedy pairwise: at each round, pick the (i, j) with cheapest pairwise
 * cost, preferring pairs with at least one shared index. Returns null if
 * every candidate pair exceeds `maxIntermediateSize`.
 */
function solveGreedy(
  shapes: ReadonlyArray<VirtualShape>,
  maxIntermediateSize: number
): { steps: ReadonlyArray<PlanStep> } | null {
  const N = shapes.length;
  // Working list of (slot id, current shape). Slot ids are the virtual indices
  // exposed in `contractionOrder`.
  const working: Array<{ slot: number; shape: VirtualShape }> = [];
  for (let i = 0; i < N; i++) working.push({ slot: i, shape: shapes[i] });
  let nextSlot = N;
  const steps: PlanStep[] = [];

  while (working.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestCost = Infinity;
    let bestStep: PairwiseStep | null = null;
    let bestSharedCount = -1; // prefer pairs with at least one shared index

    for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        const step = pairwise(working[i].shape, working[j].shape);
        if (step.resultSize > maxIntermediateSize) continue;
        // Count shared indices for tie-breaking: more sharing first.
        let shared = 0;
        for (const ix of working[i].shape.indices) {
          for (const jx of working[j].shape.indices) {
            if (ix.matches(jx)) {
              shared++;
              break;
            }
          }
        }
        const isBetter =
          step.cost < bestCost ||
          (step.cost === bestCost && shared > bestSharedCount) ||
          (step.cost === bestCost &&
            shared === bestSharedCount &&
            (i < bestI || (i === bestI && j < bestJ)));
        if (isBetter) {
          bestI = i;
          bestJ = j;
          bestCost = step.cost;
          bestStep = step;
          bestSharedCount = shared;
        }
      }
    }

    if (bestStep === null || bestI === -1) {
      return null; // every candidate pair exceeds the size cap
    }

    const slotI = working[bestI].slot;
    const slotJ = working[bestJ].slot;
    const orderedPair: readonly [number, number] = slotI <= slotJ ? [slotI, slotJ] : [slotJ, slotI];
    steps.push({ pair: orderedPair, cost: bestStep.cost, resultSize: bestStep.resultSize });

    // Replace (bestI, bestJ) in `working` with the produced intermediate.
    // Remove the higher index first so the lower index stays valid.
    working.splice(bestJ, 1);
    working.splice(bestI, 1);
    working.push({ slot: nextSlot++, shape: bestStep.resultShape });
  }

  return { steps };
}

// ---------------------------------------------------------------------------
// Plan execution
// ---------------------------------------------------------------------------

/**
 * Apply a contraction plan to the actual Tensors. The plan's `pair`
 * entries refer to virtual slots: slots 0..N-1 are the inputs; produced
 * intermediates take slot N, N+1, … in the order they appear in the plan.
 */
function executePlan(
  inputs: ReadonlyArray<Tensor>,
  plan: ReadonlyArray<PlanStep>
): { result: Tensor; intermediateSizes: number[] } {
  const slots = new Map<number, Tensor>();
  for (let i = 0; i < inputs.length; i++) slots.set(i, inputs[i]);
  let nextSlot = inputs.length;
  const intermediateSizes: number[] = [];

  for (const step of plan) {
    const [i, j] = step.pair;
    const a = slots.get(i);
    const b = slots.get(j);
    if (!a || !b) {
      throw new Error(
        `contractNetwork: plan references unknown virtual slot (${i}, ${j}); plan is corrupted`
      );
    }
    const out = a.contract(b);
    intermediateSizes.push(out.data.length);
    slots.set(nextSlot++, out);
  }

  // The last produced intermediate is the result.
  const finalSlot = nextSlot - 1;
  const result = slots.get(finalSlot);
  if (!result) throw new Error('contractNetwork: empty plan produced no result');
  return { result, intermediateSizes };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Contract a network of named-index tensors in the optimal pairwise order.
 *
 * Returns:
 *   - `result` — the fully contracted final Tensor.
 *   - `contractionOrder` — the chosen sequence of pairwise contractions in
 *     virtual-slot space (slots 0..N-1 = inputs; each produced intermediate
 *     takes the next free slot).
 *   - `totalFlops` — sum of per-step FLOP costs along the chosen order.
 *   - `intermediateSizes` — element count of each produced intermediate.
 *
 * Throws:
 *   - on empty input.
 *   - if any input lacks `axisLabels`.
 *   - if `maxIntermediateSize` is so tight no valid order exists.
 */
export function contractNetwork(
  tensors: ReadonlyArray<Tensor>,
  opts?: ContractNetworkOpts
): ContractNetworkResult {
  if (tensors.length === 0) {
    throw new Error('contractNetwork: tensors array is empty');
  }

  // Single-tensor case: pass-through. Don't require axisLabels here because
  // there's nothing to contract.
  if (tensors.length === 1) {
    return {
      result: tensors[0],
      contractionOrder: [],
      totalFlops: 0,
      intermediateSizes: [],
    };
  }

  const shapes = extractShapes(tensors);
  const maxIntermediateSize = opts?.maxIntermediateSize ?? 2 ** 31;
  const algorithmRaw = opts?.algorithm ?? 'auto';
  const N = tensors.length;
  const algorithm: 'exact' | 'greedy' =
    algorithmRaw === 'auto' ? (N <= 16 ? 'exact' : 'greedy') : algorithmRaw;

  const planResult =
    algorithm === 'exact'
      ? solveExact(shapes, maxIntermediateSize)
      : solveGreedy(shapes, maxIntermediateSize);

  if (planResult === null) {
    throw new Error(
      `contractNetwork: no valid contraction order found under maxIntermediateSize=${maxIntermediateSize}`
    );
  }

  // Sanity: net shape of the whole network is well-defined.
  // (Catches Set checks; surfaces sensible errors but does not enforce.)
  void netShape(shapes);

  const { result, intermediateSizes } = executePlan(tensors, planResult.steps);
  const contractionOrder = planResult.steps.map((s) => s.pair);
  const totalFlops = planResult.steps.reduce((acc, s) => acc + s.cost, 0);

  return {
    result,
    contractionOrder,
    totalFlops,
    intermediateSizes,
  };
}
