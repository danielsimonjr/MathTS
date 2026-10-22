/**
 * PySR commit `72a9ab9`: `calculate_scores` and `idx_model_selection`.
 *
 * Formula: score_i = -ln(loss_i / loss_{i-1}) / (c_i - c_{i-1}); first row 0;
 * loss_i <= 0 → +Infinity. Modes: accuracy, score, best (factor 1.5).
 * Every expected score was computed by hand from the formula, then checked with
 * `Object.is` against the literals below.
 */
import { describe, expect, it } from 'vitest';
import {
  paretoFront,
  scoreFront,
  selectFrontModel,
  ParetoFrontError,
  type FrontCandidate,
  type ScoredCandidate,
} from '../src/pareto-front.js';
import { paretoFront as paretoFrontFromIndex } from '../src/index.js';

function row<T>(item: T, complexity: number, loss: number): FrontCandidate<T> {
  return { item, complexity, loss };
}

function scoredRow<T>(
  item: T,
  complexity: number,
  loss: number,
  score: number | null
): ScoredCandidate<T> {
  return { item, complexity, loss, score };
}

describe('paretoFront / scoreFront / selectFrontModel', () => {
  const fixtureS: FrontCandidate<string>[] = [
    row('r0', 1, 1),
    row('r1', 2, 0.36787944117144233),
    row('r2', 3, 0.006737946999085467),
    row('r3', 4, 0.004086771438464067),
    row('r4', 5, 0.003182780796509667),
  ];

  it('fixture S: paretoFront keeps all five in order', () => {
    const front = paretoFront(fixtureS);
    expect(front).toHaveLength(5);
    expect(front.map((r) => r.item)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  });

  it('fixture S: scoreFront log scale', () => {
    const scoresDefault = scoreFront(fixtureS);
    const scoresExplicit = scoreFront(fixtureS, { lossScale: 'log' });
    expect(scoresDefault.map((r) => r.score)).toEqual([0, 1, 4, 0.5, 0.25]);
    expect(scoresExplicit.map((r) => r.score)).toEqual([0, 1, 4, 0.5, 0.25]);
    for (let i = 0; i < fixtureS.length; i++) {
      expect(scoresDefault[i].item).toBe(fixtureS[i].item);
    }
  });

  it('fixture S: selectFrontModel winners', () => {
    const scored = scoreFront(fixtureS);
    const expectWinner = (item: string, score: number) => {
      const found = scored.find((r) => r.item === item);
      expect(found).toBeDefined();
      expect(found!.score).toBe(score);
      return found!;
    };

    expect(selectFrontModel(scored)).toBe(expectWinner('r3', 0.5));
    expect(selectFrontModel(scored, 'best')).toBe(expectWinner('r3', 0.5));
    expect(selectFrontModel(scored, 'best', { bestLossFactor: 1.5 })).toBe(expectWinner('r3', 0.5));
    expect(selectFrontModel(scored, 'score')).toBe(expectWinner('r2', 4));
    expect(selectFrontModel(scored, 'accuracy')).toBe(scored.find((r) => r.item === 'r4')!);
    expect(selectFrontModel(scored, 'best', { bestLossFactor: 3 })).toBe(expectWinner('r2', 4));
  });

  it('fixture S: linear scale null scores and accuracy fallback', () => {
    const linear = scoreFront(fixtureS, { lossScale: 'linear' });
    expect(linear.map((r) => r.score)).toEqual([null, null, null, null, null]);
    const r4 = linear.find((r) => r.item === 'r4')!;
    expect(selectFrontModel(linear, 'score')).toBe(r4);
    expect(selectFrontModel(linear, 'best')).toBe(r4);
    expect(selectFrontModel(linear, 'accuracy')).toBe(r4);
  });

  const fixtureI: FrontCandidate<unknown>[] = [
    row(null, 1, 1),
    row(null, 2, 0.1353352832366127),
    row(null, 5, 0.006737946999085468),
    row(null, 6, 0.00012340980408667956),
    row(null, 8, 0),
  ];

  it('fixture I: scores including +Infinity on zero loss', () => {
    const scored = scoreFront(fixtureI);
    expect(scored[0].score).toBe(0);
    expect(scored[1].score).toBe(2);
    expect(scored[2].score).toBe(1);
    expect(scored[3].score).toBe(4);
    expect(scored[4].score).toBe(Infinity);
  });

  it('fixture I: all selection modes pick zero loss row', () => {
    const scored = scoreFront(fixtureI);
    const last = scored[4];
    expect(selectFrontModel(scored, 'accuracy')).toBe(last);
    expect(selectFrontModel(scored, 'score')).toBe(last);
    expect(selectFrontModel(scored, 'best')).toBe(last);
  });

  it('leading zero loss scores 0 on first row', () => {
    const two = scoreFront([row('a', 1, 0), row('b', 2, 1)]);
    expect(two[0].score).toBe(0);
    expect(two[1].score).toBe(-Infinity);
  });

  it('negative losses on log scale score +Infinity when cur > 0 check fails', () => {
    const neg = scoreFront([row('a', 1, -3), row('b', 2, -1)]);
    expect(neg.map((r) => r.score)).toEqual([0, Infinity]);

    const zeroSecond = scoreFront([row('a', 1, -3), row('b', 2, 0)]);
    expect(zeroSecond[1].score).toBe(Infinity);
  });

  it('pareto membership table', () => {
    const input: FrontCandidate<string>[] = [
      row('a', 3, 0.5),
      row('b', 1, 1),
      row('c', 3, 0.4),
      row('d', 3, 0.4),
      row('e', 2, 1),
      row('f', 4, 0.4),
      row('g', 5, 0.2),
      row('h', 0, NaN),
      row('i', 6, Infinity),
      row('j', 2, 0.7),
      row('k', Infinity, 1),
      row('m', 7, -Infinity),
    ];
    Object.freeze(input);
    for (const o of input) Object.freeze(o);

    const front = paretoFront(input);
    expect(front.map((r) => r.item)).toEqual(['b', 'j', 'c', 'g']);
    expect(front.map((r) => r.complexity)).toEqual([1, 2, 3, 5]);
    expect(front.map((r) => r.loss)).toEqual([1, 0.7, 0.4, 0.2]);
    expect(input[0].item).toBe('a');
  });

  it('paretoFront empty and immutability', () => {
    expect(paretoFront([])).toEqual([]);
    const one = [row('x', 1, 1)];
    const out = paretoFront(one);
    expect(out).not.toBe(one);
  });

  it('equal loss at higher complexity dropped', () => {
    const front = paretoFront([row('a', 1, 0.5), row('b', 2, 0.5)]);
    expect(front.map((r) => r.item)).toEqual(['a']);
  });

  it('zero and negative losses on front', () => {
    const front = paretoFront([row('z', 1, 0), row('pos', 2, 0.1), row('neg', 3, -1)]);
    expect(front.map((r) => r.item)).toEqual(['z', 'neg']);
  });

  it('tie-break on non-front scored lists', () => {
    const accTie = [scoredRow('later', 5, 0.2, 1), scoredRow('simpler', 1, 0.2, 9)];
    expect(selectFrontModel(accTie, 'accuracy').item).toBe('simpler');

    const scoreTieComplexity = [scoredRow('a', 4, 0.2, 2), scoredRow('b', 2, 0.3, 2)];
    expect(selectFrontModel(scoreTieComplexity, 'score').item).toBe('b');

    const scoreTieOrder = [scoredRow('a', 2, 0.3, 2), scoredRow('b', 2, 0.2, 2)];
    expect(selectFrontModel(scoreTieOrder, 'score').item).toBe('a');
    expect(selectFrontModel(scoreTieOrder, 'accuracy').item).toBe('b');

    const nanVsZero = [scoredRow('nan', 1, 1, NaN), scoredRow('zero', 2, 1, 0)];
    expect(selectFrontModel(nanVsZero, 'score').item).toBe('zero');

    const infTie = [scoredRow('inf1', 3, 1, Infinity), scoredRow('inf0', 1, 1, Infinity)];
    expect(selectFrontModel(infTie, 'score').item).toBe('inf0');
  });

  it('IEEE complexity gaps in scoreFront', () => {
    const nanGap = scoreFront([row('a', 1, 1), row('b', 1, 1)]);
    expect(Number.isNaN(nanGap[1].score)).toBe(true);

    const negInf = scoreFront([row('a', 1, 1), row('b', 1, Math.E)]);
    expect(negInf[1].score).toBe(-Infinity);

    const posInf = scoreFront([row('a', 1, Math.E), row('b', 1, 1)]);
    expect(posInf[1].score).toBe(Infinity);
  });

  it('errors', () => {
    expect(() => selectFrontModel([])).toThrow(ParetoFrontError);
    expect(() => selectFrontModel([])).toThrow(/empty front/);

    const scored = scoreFront(fixtureS);
    expect(() => selectFrontModel(scored, 'median' as 'best')).toThrow(
      /not a valid model selection strategy/
    );

    expect(() => selectFrontModel(scored, 'best', { bestLossFactor: NaN })).toThrow(
      /bestLossFactor/
    );

    expect(() => selectFrontModel([scoredRow('x', NaN, 1, 0)])).toThrow(/must be finite/);

    expect(() =>
      selectFrontModel([scoredRow('a', 1, 1, null), scoredRow('b', 2, 1, 1)], 'score')
    ).toThrow(/mixed null/);

    const negBest = [scoredRow('a', 1, -2, 0), scoredRow('b', 2, -1, 1)];
    expect(() => selectFrontModel(negBest, 'best')).toThrow(/no row has loss <=/);
    expect(selectFrontModel(negBest, 'accuracy').item).toBe('a');

    expect(scoreFront([], { lossScale: 'linear' })).toEqual([]);
    expect(() => scoreFront([row('a', 1, 1)], { lossScale: 'nope' as 'log' })).toThrow(/lossScale/);
  });

  it('scoreFront does not add score property to inputs', () => {
    const input = row('a', 1, 1);
    scoreFront([input]);
    expect('score' in input).toBe(false);
  });

  it('paretoFront re-exported from index', () => {
    expect(paretoFrontFromIndex).toBe(paretoFront);
  });
});
