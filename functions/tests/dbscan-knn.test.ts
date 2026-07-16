import { describe, it, expect } from 'vitest';
import { dbscan, knnClassify, knnRegress } from '../src/index.js';

describe('dbscan + knn', () => {
  it('dbscan finds 2 clusters + noise', () => {
    const pts = [
      [0, 0],
      [0.1, 0.1],
      [0.2, 0],
      [10, 10],
      [10.1, 10],
      [10, 10.2],
      [50, 50],
    ];
    const labels = dbscan(pts, 1.0, 2);
    const clusters = new Set(labels.filter((l) => l >= 0));
    expect(clusters.size).toBe(2);
    expect(labels[6]).toBe(-1); // far outlier is noise
  });
  it('knnClassify assigns the query to the nearest cluster label', () => {
    const train = [
      [0, 0],
      [0, 1],
      [10, 10],
      [10, 11],
    ];
    const labels = ['a', 'a', 'b', 'b'];
    const out = knnClassify(
      train,
      labels,
      [
        [0.2, 0.2],
        [10.1, 10.1],
      ],
      1
    );
    expect(out[0]).toBe('a');
    expect(out[1]).toBe('b');
  });
  it('knnClassify with k=3 majority vote', () => {
    const train = [[0], [1], [2], [10]];
    const labels = ['a', 'a', 'a', 'b'];
    expect(knnClassify(train, labels, [[1.5]], 3)[0]).toBe('a');
  });
  it('knnRegress averages the k nearest targets', () => {
    const out = knnRegress([[0], [1], [10], [11]], [0, 0, 100, 100], [[0.5]], 2);
    expect(out[0]).toBeCloseTo(0, 6);
  });
});
