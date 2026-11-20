import { describe, it, expect } from 'vitest';
import { quantileSeq, bignumber, matrix } from '../src/factories/index.js';

const q = quantileSeq as (...a: unknown[]) => unknown;

// Expected values are literal NumPy 2.3 `np.quantile(a, p, method=...)` results.
const CASES: Array<[number[], number, string, number]> = [
  [[2, 5, 5], 0.75, 'averaged_inverted_cdf', 5.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.25, 'averaged_inverted_cdf', 2.0],
  [[2, 5], 0.0, 'averaged_inverted_cdf', 2.0],
  [[-1, 2, 3, 5, 7], 0.7, 'averaged_inverted_cdf', 5.0],
  [[1.0, 2.0, 3.0], 0.9, 'averaged_inverted_cdf', 3.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.7727272727272728, 'averaged_inverted_cdf', 5.0],
  [[2, 2, 2, 5, 5, 5], 0.74, 'averaged_inverted_cdf', 5.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.2272727272727273, 'averaged_inverted_cdf', -1.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.1, 'averaged_inverted_cdf', 1.0],
  [[2, 2, 5, 5], 0.25, 'averaged_inverted_cdf', 2.0],
  [[-1, 3, 5], 0.7999999999999999, 'averaged_inverted_cdf', 5.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.625, 'averaged_inverted_cdf', 3.0],
  [[5], 1.0, 'averaged_inverted_cdf', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.3333333333333333, 'averaged_inverted_cdf', 2.5],
  [[2, 2, 2, 5, 5, 5], 0.3333333333343333, 'closest_observation', 2.0],
  [[3], 0.1, 'closest_observation', 3.0],
  [[2, 2, 2, 5, 5, 5], 0.6666666666666666, 'closest_observation', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0], 0.0, 'closest_observation', 1.0],
  [[2, 2, 5, 5], 0.9, 'closest_observation', 5.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.7727272727272728, 'closest_observation', 5.0],
  [[1.0, 2.0, 3.0], 0.1, 'closest_observation', 1.0],
  [[2, 2, 5, 5, 5], 0.599999999999, 'closest_observation', 5.0],
  [[-1, 3], 1e-12, 'closest_observation', -1.0],
  [[5], 0.1, 'closest_observation', 5.0],
  [[5], 0.75, 'closest_observation', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.7142857142867143, 'closest_observation', 5.0],
  [[3], 1.0, 'closest_observation', 3.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.14285714285714285, 'closest_observation', 1.0],
  [[2, 2, 5, 5], 0.5, 'interpolated_inverted_cdf', 2.0],
  [[2, 2, 2, 5, 5, 5], 0.10526315789473686, 'interpolated_inverted_cdf', 2.0],
  [[5], 1.0, 'interpolated_inverted_cdf', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.375, 'interpolated_inverted_cdf', 2.625],
  [[2, 2, 5, 5], 0.749999999999, 'interpolated_inverted_cdf', 4.999999999988001],
  [[2, 2, 2, 5, 5, 5], 0.499999999999, 'interpolated_inverted_cdf', 2.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.7727272727272728, 'interpolated_inverted_cdf', 3.81818181818182],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.9285714285714286, 'interpolated_inverted_cdf', 6.5],
  [[-1, 2, 3, 5, 7], 1e-12, 'interpolated_inverted_cdf', -1.0],
  [[-1, 2, 2, 3, 5, 7], 0.26315789473684215, 'interpolated_inverted_cdf', 0.7368421052631586],
  [[2, 2, 5, 5], 1.0, 'interpolated_inverted_cdf', 5.0],
  [[2, 2, 5, 5], 0.6153846153846154, 'interpolated_inverted_cdf', 3.384615384615385],
  [[2, 2, 2, 5, 5, 5], 1.0, 'interpolated_inverted_cdf', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0], 0.7, 'interpolated_inverted_cdf', 3.5],
  [[5], 0.1, 'hazen', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.999999999999, 'hazen', 6.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.0, 'hazen', 2.0],
  [[1.0, 2.0, 3.0], 0.0, 'hazen', 1.0],
  [[1.0, 2.0, 3.0, 4.0], 0.5, 'hazen', 2.5],
  [[1.0, 2.0, 3.0, 4.0, 5.0], 0.8809523809523809, 'hazen', 4.904761904761905],
  [[2, 5, 5], 0.0, 'hazen', 2.0],
  [[2, 2, 5, 5, 5], 0.999999999999, 'hazen', 5.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.8571428571438571, 'hazen', 6.0000000000139995],
  [[2, 2, 2, 5, 5, 5], 0.10526315789473686, 'hazen', 2.0],
  [[-4, -1, 2, 2, 3, 5, 7], 1.0, 'hazen', 7.0],
  [[1.0, 2.0, 3.0, 4.0], 0.6176470588235294, 'hazen', 2.9705882352941178],
  [[2, 2, 5, 5, 5], 0.11904761904761904, 'hazen', 2.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0], 0.599999999999, 'hazen', 3.499999999995],
  [[2, 2, 2, 5, 5, 5, 5], 0.7142857142847143, 'weibull', 5.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.8571428571428571, 'weibull', 6.7142857142857135],
  [[-4, -1, 2, 2, 3, 5, 7], 0.9285714285714286, 'weibull', 7.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.42, 'weibull', 2.94],
  [[2, 2, 2, 5, 5, 5, 5], 0.7142857142867143, 'weibull', 5.0],
  [[-1, 3], 0.28571428571428575, 'weibull', -1.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.375, 'weibull', 2.0],
  [[-1, 2, 3, 5, 7], 0.30952380952380953, 'weibull', 1.5714285714285716],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.6666666666666666, 'weibull', 4.666666666666667],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.9, 'weibull', 6.0],
  [[1.0, 2.0, 3.0, 4.0], 0.1, 'weibull', 1.0],
  [[-1, 2, 2, 3, 5, 7], 0.75, 'weibull', 5.5],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.8571428571438571, 'weibull', 6.857142857150857],
  [[-1, 2, 2, 3, 5, 7], 0.999999999999, 'weibull', 7.0],
  [[-1, 3, 5], 0.33333333333233334, 'median_unbiased', 0.7777777777644443],
  [[2, 2, 2, 5, 5, 5], 0.5, 'median_unbiased', 3.5],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.0, 'median_unbiased', 1.0],
  [[1.0, 2.0, 3.0], 0.3333333333333333, 'median_unbiased', 1.4444444444444444],
  [[-1, 3, 5, 7], 0.750000000001, 'median_unbiased', 6.166666666675333],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.25, 'median_unbiased', 2.1666666666666665],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.42, 'median_unbiased', 2.993333333333333],
  [[-1, 2, 2, 3, 5, 7], 0.8571428571428571, 'median_unbiased', 6.523809523809522],
  [[-4, -1, 2, 2, 3, 5, 7], 0.6379310344827587, 'median_unbiased', 3.0229885057471275],
  [[-1, 3], 0.0, 'median_unbiased', -1.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.14285714285814285, 'median_unbiased', -2.8571428571208575],
  [[-1, 3], 0.9, 'median_unbiased', 3.0],
  [[2, 2, 5, 5, 5], 0.20000000000100002, 'median_unbiased', 2.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.7857142857142857, 'median_unbiased', 5.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.4285714285724285, 'normal_unbiased', 3.446428571450321],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.42105263157894735, 'normal_unbiased', 3.006578947368421],
  [[-1, 3, 5, 7], 1.0, 'normal_unbiased', 7.0],
  [[-1, 3, 5, 7], 0.9, 'normal_unbiased', 7.0],
  [[-4, -1, 2, 2, 3, 5, 7], 0.9, 'normal_unbiased', 6.799999999999999],
  [[2, 2, 5, 5], 0.8529411764705882, 'normal_unbiased', 5.0],
  [[1.0], 0.1, 'normal_unbiased', 1.0],
  [[1.0, 2.0, 3.0, 4.0], 0.999999999999, 'normal_unbiased', 4.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.7142857142847143, 'normal_unbiased', 5.553571428564179],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.8571428571438571, 'normal_unbiased', 6.589285714292964],
  [[-1, 2, 3, 5, 7], 0.0, 'normal_unbiased', -1.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.6666666666676666, 'normal_unbiased', 4.541666666672916],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.125, 'normal_unbiased', 1.28125],
  [[-1, 2, 2, 3, 5, 7], 0.26, 'normal_unbiased', 2.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.42857142857142855, 'linear', 3.7142857142857135],
  [[-1, 2, 2, 3, 5, 7], 0.42857142857142855, 'linear', 2.142857142857143],
  [[2, 2, 2, 5, 5, 5], 1.0, 'linear', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0], 0.11904761904761904, 'linear', 1.4761904761904763],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.8571428571438571, 'nearest', 6.0],
  [[3], 0.5000000000000001, 'nearest', 3.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0], 0.16666666666666666, 'nearest', 2.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.09090909090909093, 'nearest', 2.0],
  [[2, 5, 5], 0.3333333333343333, 'inverted_cdf', 5.0],
  [[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0], 0.22413793103448276, 'inverted_cdf', 2.0],
  [[2, 2, 2, 5, 5, 5, 5], 0.1, 'inverted_cdf', 2.0],
  [[2, 2, 5, 5], 0.14705882352941177, 'inverted_cdf', 2.0],
];

describe('quantileSeq NumPy methods at low and high probability (#1110)', () => {
  it.each(CASES)('quantileSeq(%j, %d, %s) = %d', (data, p, method, expected) => {
    const got = q(data, p, method) as number;
    expect(Math.abs(got - expected)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(expected)));
  });

  it('matches the rows reported in the issue', () => {
    expect(q([2, 5], 0, 'hazen')).toBe(2);
    expect(q([1, 2, 3, 4], 0.1, 'weibull')).toBe(1);
    expect(q([1, 2], 0.25, 'averaged_inverted_cdf')).toBe(1);
    expect(q([3, -1, 5, 7, 2], 0, 'median_unbiased')).toBe(-1);
    expect(q([2, 5], 0.75, 'closest_observation')).toBe(5);
    expect(q([4, 1, 3, 2, 6, 5, 9], 0.5, 'closest_observation')).toBe(4);
  });

  it('clips both ends to the last element at p = 1 (index at or above n - 1)', () => {
    // NumPy 2.3.5: np.quantile(a, 1, method=m) for each sample.
    for (const m of ['weibull', 'hazen', 'median_unbiased', 'normal_unbiased']) {
      expect(q([1, 2, 3], 1, m)).toBe(3);
      expect(q([5], 1, m)).toBe(5);
      expect(q([1, 2, 3, 4], 1, m)).toBe(4);
    }
  });

  it('resolves a closest_observation tie to the even order statistic (Hyndman-Fan type 3)', () => {
    // NumPy 2.3.5 values. NumPy 1.26.4 took the odd order statistic.
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(q([1, 2, 3, 4, 5, 6, 7], 0.5, 'closest_observation')).toBe(4);
    expect(q(ten, 0.25, 'closest_observation')).toBe(2);
    expect(q(ten, 0.75, 'closest_observation')).toBe(8);
    expect(q([1, 2, 3, 4], 0.625, 'closest_observation')).toBe(2);
    expect(q([1, 2, 3, 4], 0.875, 'closest_observation')).toBe(4);
  });

  it('keeps an infinite clipped boundary element (#1131)', () => {
    expect(q([-Infinity, 1, 2], 0, 'hazen')).toBe(-Infinity);
    expect(q([-Infinity, 1], 0.25, 'weibull')).toBe(-Infinity);
  });

  it('keeps skipNaN, Matrix and BigNumber data working', () => {
    expect(q(matrix([5, 2]), 0, 'hazen')).toBe(2);
    expect(q([NaN, 2, 5], 0, { method: 'hazen', skipNaN: true })).toBe(2);
    expect(Number(q([bignumber(1), bignumber(2), bignumber(3), bignumber(4)], 0.5))).toBe(2.5);
  });
});
