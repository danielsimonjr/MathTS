/**
 * mathjs 15.3.0 `distance` and `intersect` factories for the compat surface (#1792).
 *
 * Native MathTS geometry uses stable scaled distance and stricter matrix coercion;
 * the compat instance matches mathjs's arithmetic, row/column coercion, and messages.
 */

import { isBigNumber } from '@danielsimonjr/mathts-core';
import type { TypedFunction } from '@danielsimonjr/mathts-core';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import {
  isMathjsFraction,
  mathjsFractionClass,
  type MathjsFraction,
} from './mathjs-fraction-class.js';
type Scalar = unknown;

type MatrixLike = {
  valueOf(): unknown;
};

/**
 * `subtract` that accepts mathjs `Fraction` pairs like mathjs 15.3.0 (native
 * typed `subtract` expects core `Fraction` instances with `.subtract`).
 */
export function geometrySubtract(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((entry, index) => geometrySubtract(entry, b[index]));
  }
  if (isMathjsFraction(a) && isMathjsFraction(b)) {
    return new mathjsFractionClass(a as MathjsFraction).sub(b as MathjsFraction);
  }
  return mathFunctions.subtract(a, b);
}

type NumericBinary = (a: unknown, b: unknown) => unknown;
type NumericUnary = (x: unknown) => unknown;
type NumericArrayBinary = (a: unknown | unknown[], b: unknown | unknown[]) => unknown | unknown[];

export interface MathjsDistanceDeps {
  typed: TypedFunction;
  addScalar: NumericBinary;
  subtractScalar: NumericBinary;
  multiplyScalar: NumericBinary;
  divideScalar: NumericBinary;
  deepEqual: (a: unknown, b: unknown) => boolean;
  sqrt: NumericUnary;
  abs: NumericUnary;
}

function distanceIsNumber(a: unknown): a is Scalar {
  return typeof a === 'number' || isBigNumber(a);
}

/**
 * Builds the mathjs 15.3.0 `distance` typed function from factory dependencies.
 */
export function createMathjsDistance(deps: MathjsDistanceDeps): TypedFunction {
  const { typed, addScalar, subtractScalar, multiplyScalar, divideScalar, deepEqual, sqrt, abs } =
    deps;

  const name = 'distance';

  function objectToArray(o: Record<string, Scalar>): Scalar[] {
    const keys = Object.keys(o);
    const a: Scalar[] = [];
    for (let i = 0; i < keys.length; i++) {
      a.push(o[keys[i]]);
    }
    return a;
  }

  function asRecord(x: Scalar[] | Record<string, Scalar>): Record<string, Scalar> {
    return x as Record<string, Scalar>;
  }

  function is2d(a: Scalar[] | Record<string, Scalar>): boolean {
    if ((a as { constructor?: unknown }).constructor !== Array) {
      a = objectToArray(asRecord(a));
    }
    const arr = a as Scalar[];
    return distanceIsNumber(arr[0]) && distanceIsNumber(arr[1]);
  }

  function is3d(a: Scalar[] | Record<string, Scalar>): boolean {
    if ((a as { constructor?: unknown }).constructor !== Array) {
      a = objectToArray(asRecord(a));
    }
    const arr = a as Scalar[];
    return distanceIsNumber(arr[0]) && distanceIsNumber(arr[1]) && distanceIsNumber(arr[2]);
  }

  function containsOnlyNumbers(a: Scalar[] | Record<string, Scalar>): boolean {
    if (!Array.isArray(a)) {
      a = objectToArray(asRecord(a));
    }
    return (a as Scalar[]).every(distanceIsNumber);
  }

  function parametricLine(a: Scalar[] | Record<string, Scalar>): boolean {
    if ((a as { constructor?: unknown }).constructor !== Array) {
      a = objectToArray(asRecord(a));
    }
    const arr = a as Scalar[];
    return (
      distanceIsNumber(arr[0]) &&
      distanceIsNumber(arr[1]) &&
      distanceIsNumber(arr[2]) &&
      distanceIsNumber(arr[3]) &&
      distanceIsNumber(arr[4]) &&
      distanceIsNumber(arr[5])
    );
  }

  function pairwise(points: Scalar[][]): boolean {
    if (
      points[0].length === 2 &&
      distanceIsNumber(points[0][0]) &&
      distanceIsNumber(points[0][1])
    ) {
      if (
        points.some(
          (row) => row.length !== 2 || !distanceIsNumber(row[0]) || !distanceIsNumber(row[1])
        )
      ) {
        return false;
      }
    } else if (
      points[0].length === 3 &&
      distanceIsNumber(points[0][0]) &&
      distanceIsNumber(points[0][1]) &&
      distanceIsNumber(points[0][2])
    ) {
      if (
        points.some(
          (row) =>
            row.length !== 3 ||
            !distanceIsNumber(row[0]) ||
            !distanceIsNumber(row[1]) ||
            !distanceIsNumber(row[2])
        )
      ) {
        return false;
      }
    } else {
      return false;
    }
    return true;
  }

  function distancePointLine2D(x: Scalar, y: Scalar, a: Scalar, b: Scalar, c: Scalar): Scalar {
    const num = abs(addScalar(addScalar(multiplyScalar(a, x), multiplyScalar(b, y)), c));
    const den = sqrt(addScalar(multiplyScalar(a, a), multiplyScalar(b, b)));
    return divideScalar(num, den);
  }

  function distancePointLine3D(
    x: Scalar,
    y: Scalar,
    z: Scalar,
    x0: Scalar,
    y0: Scalar,
    z0: Scalar,
    a: Scalar,
    b: Scalar,
    c: Scalar
  ): Scalar {
    const numVec: Scalar[] = [
      subtractScalar(
        multiplyScalar(subtractScalar(y0, y), c),
        multiplyScalar(subtractScalar(z0, z), b)
      ),
      subtractScalar(
        multiplyScalar(subtractScalar(z0, z), a),
        multiplyScalar(subtractScalar(x0, x), c)
      ),
      subtractScalar(
        multiplyScalar(subtractScalar(x0, x), b),
        multiplyScalar(subtractScalar(y0, y), a)
      ),
    ];
    const num = sqrt(
      addScalar(
        addScalar(multiplyScalar(numVec[0], numVec[0]), multiplyScalar(numVec[1], numVec[1])),
        multiplyScalar(numVec[2], numVec[2])
      )
    );
    const den = sqrt(
      addScalar(addScalar(multiplyScalar(a, a), multiplyScalar(b, b)), multiplyScalar(c, c))
    );
    return divideScalar(num, den);
  }

  function euclideanDistance(x: Scalar[], y: Scalar[]): Scalar {
    const vectorSize = x.length;
    let result: Scalar = 0;
    for (let i = 0; i < vectorSize; i++) {
      const diff = subtractScalar(x[i], y[i]);
      result = addScalar(multiplyScalar(diff, diff), result);
    }
    return sqrt(result);
  }

  function distancePairwise(points: Scalar[][]): Scalar[] {
    const result: Scalar[] = [];
    let pointA: Scalar[] = [];
    let pointB: Scalar[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[0].length === 2) {
          pointA = [points[i][0], points[i][1]];
          pointB = [points[j][0], points[j][1]];
        } else if (points[0].length === 3) {
          pointA = [points[i][0], points[i][1], points[i][2]];
          pointB = [points[j][0], points[j][1], points[j][2]];
        }
        result.push(euclideanDistance(pointA, pointB));
      }
    }
    return result;
  }

  return typed(name, {
    'Array, Array, Array': function (x: Scalar[], y: Scalar[], z: Scalar[]) {
      if (x.length === 2 && y.length === 2 && z.length === 2) {
        if (!is2d(x)) {
          throw new TypeError('Array with 2 numbers or BigNumbers expected for first argument');
        }
        if (!is2d(y)) {
          throw new TypeError('Array with 2 numbers or BigNumbers expected for second argument');
        }
        if (!is2d(z)) {
          throw new TypeError('Array with 2 numbers or BigNumbers expected for third argument');
        }
        if (deepEqual(y, z)) {
          throw new TypeError('LinePoint1 should not be same with LinePoint2');
        }
        const xCoeff = subtractScalar(z[1], y[1]);
        const yCoeff = subtractScalar(y[0], z[0]);
        const constant = subtractScalar(multiplyScalar(z[0], y[1]), multiplyScalar(y[0], z[1]));
        return distancePointLine2D(x[0], x[1], xCoeff, yCoeff, constant);
      }
      throw new TypeError('Invalid Arguments: Try again');
    },
    'Object, Object, Object': function (
      x: Record<string, Scalar>,
      y: Record<string, Scalar>,
      z: Record<string, Scalar>
    ) {
      if (
        Object.keys(x).length === 2 &&
        Object.keys(y).length === 2 &&
        Object.keys(z).length === 2
      ) {
        if (!is2d(x)) {
          throw new TypeError('Values of pointX and pointY should be numbers or BigNumbers');
        }
        if (!is2d(y)) {
          throw new TypeError(
            'Values of lineOnePtX and lineOnePtY should be numbers or BigNumbers'
          );
        }
        if (!is2d(z)) {
          throw new TypeError(
            'Values of lineTwoPtX and lineTwoPtY should be numbers or BigNumbers'
          );
        }
        if (deepEqual(objectToArray(y), objectToArray(z))) {
          throw new TypeError('LinePoint1 should not be same with LinePoint2');
        }
        if (
          'pointX' in x &&
          'pointY' in x &&
          'lineOnePtX' in y &&
          'lineOnePtY' in y &&
          'lineTwoPtX' in z &&
          'lineTwoPtY' in z
        ) {
          const xCoeff = subtractScalar(z.lineTwoPtY, y.lineOnePtY);
          const yCoeff = subtractScalar(y.lineOnePtX, z.lineTwoPtX);
          const constant = subtractScalar(
            multiplyScalar(z.lineTwoPtX, y.lineOnePtY),
            multiplyScalar(y.lineOnePtX, z.lineTwoPtY)
          );
          return distancePointLine2D(x.pointX, x.pointY, xCoeff, yCoeff, constant);
        }
        throw new TypeError('Key names do not match');
      }
      throw new TypeError('Invalid Arguments: Try again');
    },
    'Array, Array': function (x: Scalar[], y: Scalar[]) {
      if (x.length === 2 && y.length === 3) {
        if (!is2d(x)) {
          throw new TypeError('Array with 2 numbers or BigNumbers expected for first argument');
        }
        if (!is3d(y)) {
          throw new TypeError('Array with 3 numbers or BigNumbers expected for second argument');
        }
        return distancePointLine2D(x[0], x[1], y[0], y[1], y[2]);
      }
      if (x.length === 3 && y.length === 6) {
        if (!is3d(x)) {
          throw new TypeError('Array with 3 numbers or BigNumbers expected for first argument');
        }
        if (!parametricLine(y)) {
          throw new TypeError('Array with 6 numbers or BigNumbers expected for second argument');
        }
        return distancePointLine3D(x[0], x[1], x[2], y[0], y[1], y[2], y[3], y[4], y[5]);
      }
      if (x.length === y.length && x.length > 0) {
        if (!containsOnlyNumbers(x)) {
          throw new TypeError('All values of an array should be numbers or BigNumbers');
        }
        if (!containsOnlyNumbers(y)) {
          throw new TypeError('All values of an array should be numbers or BigNumbers');
        }
        return euclideanDistance(x, y);
      }
      throw new TypeError('Invalid Arguments: Try again');
    },
    'Object, Object': function (x: Record<string, Scalar>, y: Record<string, Scalar>) {
      if (Object.keys(x).length === 2 && Object.keys(y).length === 3) {
        if (!is2d(x)) {
          throw new TypeError('Values of pointX and pointY should be numbers or BigNumbers');
        }
        if (!is3d(y)) {
          throw new TypeError(
            'Values of xCoeffLine, yCoeffLine and constant should be numbers or BigNumbers'
          );
        }
        if (
          'pointX' in x &&
          'pointY' in x &&
          'xCoeffLine' in y &&
          'yCoeffLine' in y &&
          'constant' in y
        ) {
          return distancePointLine2D(x.pointX, x.pointY, y.xCoeffLine, y.yCoeffLine, y.constant);
        }
        throw new TypeError('Key names do not match');
      }
      if (Object.keys(x).length === 3 && Object.keys(y).length === 6) {
        if (!is3d(x)) {
          throw new TypeError(
            'Values of pointX, pointY and pointZ should be numbers or BigNumbers'
          );
        }
        if (!parametricLine(y)) {
          throw new TypeError('Values of x0, y0, z0, a, b and c should be numbers or BigNumbers');
        }
        if (
          'pointX' in x &&
          'pointY' in x &&
          'x0' in y &&
          'y0' in y &&
          'z0' in y &&
          'a' in y &&
          'b' in y &&
          'c' in y
        ) {
          return distancePointLine3D(x.pointX, x.pointY, x.pointZ, y.x0, y.y0, y.z0, y.a, y.b, y.c);
        }
        throw new TypeError('Key names do not match');
      }
      if (Object.keys(x).length === 2 && Object.keys(y).length === 2) {
        if (!is2d(x)) {
          throw new TypeError('Values of pointOneX and pointOneY should be numbers or BigNumbers');
        }
        if (!is2d(y)) {
          throw new TypeError('Values of pointTwoX and pointTwoY should be numbers or BigNumbers');
        }
        if ('pointOneX' in x && 'pointOneY' in x && 'pointTwoX' in y && 'pointTwoY' in y) {
          return euclideanDistance([x.pointOneX, x.pointOneY], [y.pointTwoX, y.pointTwoY]);
        }
        throw new TypeError('Key names do not match');
      }
      if (Object.keys(x).length === 3 && Object.keys(y).length === 3) {
        if (!is3d(x)) {
          throw new TypeError(
            'Values of pointOneX, pointOneY and pointOneZ should be numbers or BigNumbers'
          );
        }
        if (!is3d(y)) {
          throw new TypeError(
            'Values of pointTwoX, pointTwoY and pointTwoZ should be numbers or BigNumbers'
          );
        }
        if (
          'pointOneX' in x &&
          'pointOneY' in x &&
          'pointOneZ' in x &&
          'pointTwoX' in y &&
          'pointTwoY' in y &&
          'pointTwoZ' in y
        ) {
          return euclideanDistance(
            [x.pointOneX, x.pointOneY, x.pointOneZ],
            [y.pointTwoX, y.pointTwoY, y.pointTwoZ]
          );
        }
        throw new TypeError('Key names do not match');
      }
      throw new TypeError('Invalid Arguments: Try again');
    },
    Array: function (arr: Scalar[][]) {
      if (!pairwise(arr)) {
        throw new TypeError('Incorrect array format entered for pairwise distance calculation');
      }
      return distancePairwise(arr);
    },
  }) as TypedFunction;
}

export interface MathjsIntersectDeps {
  typed: TypedFunction;
  config: { relTol: number };
  abs: NumericUnary;
  add: NumericArrayBinary;
  addScalar: NumericBinary;
  matrix: (data: unknown) => MatrixLike;
  multiply: NumericArrayBinary;
  multiplyScalar: NumericBinary;
  divideScalar: NumericBinary;
  subtract: NumericArrayBinary;
  smaller: (a: unknown, b: number) => boolean;
  equalScalar: NumericBinary;
  flatten: (arr: Scalar[][]) => Scalar[];
  isZero: (x: Scalar) => boolean;
  isNumeric: (x: unknown) => boolean;
}

/**
 * Builds the mathjs 15.3.0 `intersect` typed function from factory dependencies.
 */
export function createMathjsIntersect(deps: MathjsIntersectDeps): TypedFunction {
  const {
    typed,
    config,
    abs,
    add,
    addScalar,
    matrix,
    multiply,
    multiplyScalar,
    divideScalar,
    subtract,
    smaller,
    equalScalar,
    flatten,
    isZero,
    isNumeric,
  } = deps;

  /** Read numeric data from a typed-function Matrix stub or compat matrix value. */
  function matrixValueAsArray(value: object): Scalar[] | Scalar[][] {
    const vo = (value as { valueOf?: () => unknown }).valueOf?.();
    if (Array.isArray(vo)) {
      return vo as Scalar[] | Scalar[][];
    }
    const stub = value as {
      rows?: number;
      cols?: number;
      data?: Scalar[];
      get?: (r: number, c: number) => Scalar;
    };
    const rows = stub.rows ?? 0;
    const cols = stub.cols ?? 0;
    if (Array.isArray(stub.data) && cols === 0) {
      return stub.data;
    }
    if (
      rows === 1 &&
      cols > 1 &&
      Array.isArray(stub.data) &&
      stub.data.length === cols &&
      typeof stub.get === 'function'
    ) {
      return stub.data;
    }
    if (cols === 1 && rows > 0 && typeof stub.get === 'function') {
      const out: Scalar[] = [];
      for (let i = 0; i < rows; i++) out.push(stub.get(i, 0));
      return out;
    }
    if (rows === 1 && cols > 0 && typeof stub.get === 'function') {
      const out: Scalar[] = [];
      for (let j = 0; j < cols; j++) out.push(stub.get(0, j));
      return out;
    }
    return (matrix(value) as { valueOf(): unknown }).valueOf() as Scalar[] | Scalar[][];
  }

  /** Coerce a matrix or array argument to a flat coordinate list (mathjs 15.3.0). */
  function toPointCoords(value: unknown): Scalar[] {
    if (Array.isArray(value)) {
      return coerceArr(value as Scalar[] | Scalar[][]);
    }
    if (typeof value === 'object' && value !== null) {
      return coerceArr(matrixValueAsArray(value));
    }
    return coerceArr(value as Scalar[] | Scalar[][]);
  }

  function coerceArr(arr: Scalar[] | Scalar[][]): Scalar[] {
    if (arr.length === 1) return arr[0] as Scalar[];
    if (arr.length > 1 && Array.isArray(arr[0])) {
      if ((arr as Scalar[][]).every((el) => Array.isArray(el) && el.length === 1)) {
        return flatten(arr as Scalar[][]);
      }
    }
    return arr as Scalar[];
  }

  function is2d(x: Scalar[]): boolean {
    return x.length === 2 && isNumeric(x[0]) && isNumeric(x[1]);
  }

  function is3d(x: Scalar[]): boolean {
    return x.length === 3 && isNumeric(x[0]) && isNumeric(x[1]) && isNumeric(x[2]);
  }

  function is4d(x: Scalar[]): boolean {
    return (
      x.length === 4 && isNumeric(x[0]) && isNumeric(x[1]) && isNumeric(x[2]) && isNumeric(x[3])
    );
  }

  function intersect2d(
    p1a: Scalar[],
    p1b: Scalar[],
    p2a: Scalar[],
    p2b: Scalar[]
  ): Scalar[] | null {
    const o1 = p1a;
    const o2 = p2a;
    const d1 = subtract(o1, p1b) as Scalar[];
    const d2 = subtract(o2, p2b) as Scalar[];
    const det = subtract(multiplyScalar(d1[0], d2[1]), multiplyScalar(d2[0], d1[1])) as Scalar;
    if (isZero(det)) return null;
    if (smaller(abs(det), config.relTol)) {
      return null;
    }
    const d20o11 = multiplyScalar(d2[0], o1[1]);
    const d21o10 = multiplyScalar(d2[1], o1[0]);
    const d20o21 = multiplyScalar(d2[0], o2[1]);
    const d21o20 = multiplyScalar(d2[1], o2[0]);
    const t = divideScalar(
      addScalar(subtract(subtract(d20o11, d21o10) as Scalar, d20o21) as Scalar, d21o20),
      det
    );
    return add(multiply(d1, t), o1) as Scalar[];
  }

  function intersect3dHelper(
    a: Scalar,
    b: Scalar,
    c: Scalar,
    d: Scalar,
    e: Scalar,
    f: Scalar,
    g: Scalar,
    h: Scalar,
    i: Scalar,
    j: Scalar,
    k: Scalar,
    l: Scalar
  ): Scalar {
    const add1 = multiplyScalar(subtract(a, b) as Scalar, subtract(c, d) as Scalar);
    const add2 = multiplyScalar(subtract(e, f) as Scalar, subtract(g, h) as Scalar);
    const add3 = multiplyScalar(subtract(i, j) as Scalar, subtract(k, l) as Scalar);
    return addScalar(addScalar(add1, add2), add3);
  }

  function intersect3d(
    x1: Scalar,
    y1: Scalar,
    z1: Scalar,
    x2: Scalar,
    y2: Scalar,
    z2: Scalar,
    x3: Scalar,
    y3: Scalar,
    z3: Scalar,
    x4: Scalar,
    y4: Scalar,
    z4: Scalar
  ): Scalar[] | null {
    const d1343 = intersect3dHelper(x1, x3, x4, x3, y1, y3, y4, y3, z1, z3, z4, z3);
    const d4321 = intersect3dHelper(x4, x3, x2, x1, y4, y3, y2, y1, z4, z3, z2, z1);
    const d1321 = intersect3dHelper(x1, x3, x2, x1, y1, y3, y2, y1, z1, z3, z2, z1);
    const d4343 = intersect3dHelper(x4, x3, x4, x3, y4, y3, y4, y3, z4, z3, z4, z3);
    const d2121 = intersect3dHelper(x2, x1, x2, x1, y2, y1, y2, y1, z2, z1, z2, z1);
    const numerator = subtract(
      multiplyScalar(d1343, d4321),
      multiplyScalar(d1321, d4343)
    ) as Scalar;
    const denominator = subtract(
      multiplyScalar(d2121, d4343),
      multiplyScalar(d4321, d4321)
    ) as Scalar;
    if (isZero(denominator)) return null;
    const ta = divideScalar(numerator, denominator);
    const tb = divideScalar(addScalar(d1343, multiplyScalar(ta, d4321)), d4343);

    const pax = addScalar(x1, multiplyScalar(ta, subtract(x2, x1) as Scalar));
    const pay = addScalar(y1, multiplyScalar(ta, subtract(y2, y1) as Scalar));
    const paz = addScalar(z1, multiplyScalar(ta, subtract(z2, z1) as Scalar));
    const pbx = addScalar(x3, multiplyScalar(tb, subtract(x4, x3) as Scalar));
    const pby = addScalar(y3, multiplyScalar(tb, subtract(y4, y3) as Scalar));
    const pbz = addScalar(z3, multiplyScalar(tb, subtract(z4, z3) as Scalar));
    if (equalScalar(pax, pbx) && equalScalar(pay, pby) && equalScalar(paz, pbz)) {
      return [pax, pay, paz];
    }
    return null;
  }

  function intersectLinePlane(
    x1: Scalar,
    y1: Scalar,
    z1: Scalar,
    x2: Scalar,
    y2: Scalar,
    z2: Scalar,
    x: Scalar,
    y: Scalar,
    z: Scalar,
    c: Scalar
  ): Scalar[] {
    const x1x = multiplyScalar(x1, x);
    const x2x = multiplyScalar(x2, x);
    const y1y = multiplyScalar(y1, y);
    const y2y = multiplyScalar(y2, y);
    const z1z = multiplyScalar(z1, z);
    const z2z = multiplyScalar(z2, z);

    const numerator = subtract(subtract(subtract(c, x1x) as Scalar, y1y) as Scalar, z1z) as Scalar;
    const denominator = subtract(
      subtract(subtract(addScalar(addScalar(x2x, y2y), z2z), x1x) as Scalar, y1y) as Scalar,
      z1z
    ) as Scalar;

    const t = divideScalar(numerator, denominator);

    const px = addScalar(x1, multiplyScalar(t, subtract(x2, x1) as Scalar));
    const py = addScalar(y1, multiplyScalar(t, subtract(y2, y1) as Scalar));
    const pz = addScalar(z1, multiplyScalar(t, subtract(z2, z1) as Scalar));
    return [px, py, pz];
  }

  function linePlane(x: unknown, y: unknown, plane: unknown): Scalar[] | null {
    const xArr = toPointCoords(x);
    const yArr = toPointCoords(y);
    const planeArr = toPointCoords(plane);
    if (!is3d(xArr)) {
      throw new TypeError('Array with 3 numbers or BigNumbers expected for first argument');
    }
    if (!is3d(yArr)) {
      throw new TypeError('Array with 3 numbers or BigNumbers expected for second argument');
    }
    if (!is4d(planeArr)) {
      throw new TypeError('Array with 4 numbers expected as third argument');
    }
    return intersectLinePlane(
      xArr[0],
      xArr[1],
      xArr[2],
      yArr[0],
      yArr[1],
      yArr[2],
      planeArr[0],
      planeArr[1],
      planeArr[2],
      planeArr[3]
    );
  }

  function lineLine(w: unknown, x: unknown, y: unknown, z: unknown): Scalar[] | null {
    const wArr = toPointCoords(w);
    const xArr = toPointCoords(x);
    const yArr = toPointCoords(y);
    const zArr = toPointCoords(z);

    if (wArr.length === 2) {
      if (!is2d(wArr)) {
        throw new TypeError('Array with 2 numbers or BigNumbers expected for first argument');
      }
      if (!is2d(xArr)) {
        throw new TypeError('Array with 2 numbers or BigNumbers expected for second argument');
      }
      if (!is2d(yArr)) {
        throw new TypeError('Array with 2 numbers or BigNumbers expected for third argument');
      }
      if (!is2d(zArr)) {
        throw new TypeError('Array with 2 numbers or BigNumbers expected for fourth argument');
      }
      return intersect2d(wArr, xArr, yArr, zArr);
    }
    if (wArr.length === 3) {
      if (!is3d(wArr)) {
        throw new TypeError('Array with 3 numbers or BigNumbers expected for first argument');
      }
      if (!is3d(xArr)) {
        throw new TypeError('Array with 3 numbers or BigNumbers expected for second argument');
      }
      if (!is3d(yArr)) {
        throw new TypeError('Array with 3 numbers or BigNumbers expected for third argument');
      }
      if (!is3d(zArr)) {
        throw new TypeError('Array with 3 numbers or BigNumbers expected for fourth argument');
      }
      return intersect3d(
        wArr[0],
        wArr[1],
        wArr[2],
        xArr[0],
        xArr[1],
        xArr[2],
        yArr[0],
        yArr[1],
        yArr[2],
        zArr[0],
        zArr[1],
        zArr[2]
      );
    }
    throw new TypeError('Arrays with two or three dimensional points expected');
  }

  return typed('intersect', {
    'Array, Array, Array': linePlane,
    'Array, Array, Array, Array': lineLine,
    'Matrix, Matrix, Matrix': function (x: unknown, y: unknown, plane: unknown) {
      const arr = linePlane(
        (x as { valueOf(): unknown }).valueOf(),
        (y as { valueOf(): unknown }).valueOf(),
        (plane as { valueOf(): unknown }).valueOf()
      );
      return arr === null ? null : matrix(arr);
    },
    'Matrix, Matrix, Matrix, Matrix': function (w: unknown, x: unknown, y: unknown, z: unknown) {
      const arr = lineLine(
        (w as { valueOf(): unknown }).valueOf(),
        (x as { valueOf(): unknown }).valueOf(),
        (y as { valueOf(): unknown }).valueOf(),
        (z as { valueOf(): unknown }).valueOf()
      );
      return arr === null ? null : matrix(arr);
    },
  }) as TypedFunction;
}
