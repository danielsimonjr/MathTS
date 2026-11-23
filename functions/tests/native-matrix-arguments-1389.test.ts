import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { describe, expect, it } from 'vitest';
import {
  bartlettTest,
  convexHull2D,
  corrcoef,
  fft2d,
  gaussianProcessRegression,
  leastSquares,
  logdet,
  matrixRank,
  polygonArea,
  ridge,
  shortestPath,
  subspaceAngles,
} from '../src/index.js';

const square = [
  [4, 1],
  [1, 3],
];
const coordinates = [
  [0, 0],
  [2, 0],
  [2, 1],
  [0, 1],
];

describe('#1389 native matrix arguments', () => {
  for (const toNative of [
    DenseMatrix.fromArray,
    (rows: number[][]) => SparseMatrix.fromDense(DenseMatrix.fromArray(rows)),
  ]) {
    it('feeds decompositions, solvers and signal transforms through their row input', () => {
      const matrix = toNative(square);
      expect(matrixRank(matrix)).toBe(matrixRank(square));
      expect(logdet(matrix)).toEqual(logdet(square));
      expect(leastSquares(matrix, [1, 2])).toEqual(leastSquares(square, [1, 2]));
      expect(subspaceAngles(matrix, matrix)).toEqual(subspaceAngles(square, square));
      expect(fft2d(matrix)).toEqual(fft2d(square));
    });

    it('feeds statistics, geometry and graph operations without changing the input', () => {
      const matrix = toNative(coordinates);
      expect(polygonArea(matrix)).toBe(2);
      expect(convexHull2D(matrix)).toEqual(convexHull2D(coordinates));
      expect(corrcoef(matrix)).toEqual(corrcoef(coordinates));
      expect(matrix.toArray()).toEqual(coordinates);
      const graph = [
        [0, 1, 4],
        [0, 0, 1],
        [0, 0, 0],
      ];
      expect(shortestPath(toNative(graph), 0, 2)).toEqual(shortestPath(graph, 0, 2));
    });

    it('fits identical models from native matrices and row arrays', () => {
      const matrix = toNative(coordinates);
      const y = [1, 3, 4, 2];
      expect(ridge(matrix, y, 0.1)).toEqual(ridge(coordinates, y, 0.1));
      const predict = (model: ReturnType<typeof gaussianProcessRegression>) =>
        model.predict([[1, 0]]);
      expect(predict(gaussianProcessRegression(matrix, y))).toEqual(
        predict(gaussianProcessRegression(coordinates, y))
      );
    });
  }

  it('keeps valid ragged array groups', () => {
    expect(
      bartlettTest([
        [1, 2],
        [1, 3, 5],
      ]).statistic
    ).toBeGreaterThan(0);
  });
});
