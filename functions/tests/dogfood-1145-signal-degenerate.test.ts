/**
 * #1145: Matrix input and degenerate input of the signal functions.
 *
 * Oracle: NumPy 2.3.5 (`numpy.fft`, a periodogram of the tapered signal). The spectral rows use
 * `toBeCloseTo(v, 12)` because the package FFT and NumPy's pocketfft add the terms in a different order.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as F from '../src/index.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';
import { AS_WASM_MISSING_MESSAGE, AS_WASM_PATH } from './helpers/wasm-spy.js';

const matrix = (data: number[]): never => F.matrix(data) as never;

function closeTo(got: readonly number[], want: readonly number[], digits = 12): void {
  expect(got).toHaveLength(want.length);
  for (let i = 0; i < want.length; i++) expect(got[i], `bin ${i}`).toBeCloseTo(want[i], digits);
}

describe('#1145 signal functions reject a Matrix by name', () => {
  const m = matrix([1, 2, 3, 4]);
  const fns: [string, (x: never) => unknown][] = [
    ['dct', F.dct as never],
    ['idct', F.idct as never],
    ['dst', F.dst as never],
    ['idst', F.idst as never],
    ['hilbertTransform', F.hilbertTransform as never],
    ['spectrogram', F.spectrogram as never],
  ];
  it.each(fns)('%s throws a TypeError that names the function', (name, fn) => {
    expect(() => fn(m)).toThrow(TypeError);
    expect(() => fn(m)).toThrow(new RegExp(`^${name}: signal must be an array or a typed array`));
  });

  it('dct(matrix([5])) no longer returns [null]', () => {
    expect(() => F.dct(matrix([5]))).toThrow(/^dct: /);
  });

  it('array and typed-array inputs keep their values', () => {
    const want = F.dct([1, 2, 3, 4]);
    expect(want).toHaveLength(4);
    expect(want.every((v) => Number.isFinite(v))).toBe(true);
    expect(F.dct(new Float64Array([1, 2, 3, 4]) as never)).toEqual(want);
    expect(F.evaluate('dct([1,2,3,4])')).toEqual(want);
    expect(F.evaluate('hilbertTransform([1,2,3,4])')).toEqual(F.hilbertTransform([1, 2, 3, 4]));
  });
});

describe('#1145 fftshift and ifftshift accept a Matrix', () => {
  it('fftshift(matrix) rolls by floor(n/2) and returns a plain array', () => {
    expect(F.fftshift(matrix([1, 2, 3, 4]))).toEqual([3, 4, 1, 2]);
    expect(F.fftshift(matrix([1, 2, 3, 4, 5]))).toEqual([4, 5, 1, 2, 3]);
  });
  it('ifftshift(matrix) rolls by ceil(n/2) and returns a plain array', () => {
    expect(F.ifftshift(matrix([1, 2, 3, 4]))).toEqual([3, 4, 1, 2]);
    expect(F.ifftshift(matrix([1, 2, 3, 4, 5]))).toEqual([3, 4, 5, 1, 2]);
  });
  it('the Matrix result equals the array result', () => {
    expect(F.fftshift(matrix([1, 2, 3, 4, 5]))).toEqual(F.fftshift([1, 2, 3, 4, 5]));
    expect(F.ifftshift(matrix([1, 2, 3, 4, 5]))).toEqual(F.ifftshift([1, 2, 3, 4, 5]));
  });
  it('a typed array is accepted', () => {
    expect(F.fftshift(new Float64Array([1, 2, 3, 4, 5]) as never)).toEqual([4, 5, 1, 2, 3]);
  });
  it('odd lengths equal numpy.fft.fftshift and numpy.fft.ifftshift (numpy 2.3.5)', () => {
    const rows: [number, number[], number[]][] = [
      [3, [2, 0, 1], [1, 2, 0]],
      [5, [3, 4, 0, 1, 2], [2, 3, 4, 0, 1]],
      [7, [4, 5, 6, 0, 1, 2, 3], [3, 4, 5, 6, 0, 1, 2]],
    ];
    for (const [n, shifted, unshifted] of rows) {
      const x = Array.from({ length: n }, (_, i) => i);
      expect(F.fftshift(x), `fftshift n=${n}`).toEqual(shifted);
      expect(F.ifftshift(x), `ifftshift n=${n}`).toEqual(unshifted);
      expect(F.ifftshift(F.fftshift(x))).toEqual(x);
    }
  });
  it('rejects a value that is not an array or a Matrix, by name', () => {
    expect(() => F.fftshift(5 as never)).toThrow(/^fftshift: expected an array or Matrix/);
    expect(() => F.ifftshift('abc' as never)).toThrow(/^ifftshift: expected an array or Matrix/);
  });
});

describe('#1145 welchPSD with a Hann window of length 2', () => {
  it.each(['hann', 'hanning'])('throws a RangeError for the "%s" window', (window) => {
    expect(() => F.welchPSD([5, 6], { window })).toThrow(RangeError);
    expect(() => F.welchPSD([5, 6], { window })).toThrow(/welchPSD: a 'hann' window of length 2/);
    expect(() => F.welchPSD([5, 6, 7, 8], { frameLength: 2, window })).toThrow(
      /welchPSD: a 'hann' window of length 2/
    );
  });
  it('the default window throws for welchPSD([5,6]) and welchPSD([5,6,7,8],{frameLength:2})', () => {
    expect(() => F.welchPSD([5, 6])).toThrow(/welchPSD: a 'hann' window of length 2/);
    expect(() => F.welchPSD([5, 6, 7, 8], { frameLength: 2 })).toThrow(
      /welchPSD: a 'hann' window of length 2/
    );
  });
  it('other windows of length 2 stay finite', () => {
    for (const window of ['hamming', 'blackman', 'rect', 'rectangular']) {
      const { psd } = F.welchPSD([5, 6], { window });
      expect(
        psd.every((v) => Number.isFinite(v)),
        window
      ).toBe(true);
    }
    expect(F.welchPSD([5, 6], { window: 'rect' }).psd).toEqual([60.5, 0.5]);
  });
  it('pin: an empty signal still returns an empty PSD', () => {
    expect(F.welchPSD([]).psd).toEqual([]);
  });
});

describe('#1145 multiTaperPSD of a length that is not a power of two', () => {
  it('multiTaperPSD([1,2,3,4,5]) fills five bins on the k/8 grid', () => {
    const r = F.multiTaperPSD([1, 2, 3, 4, 5]);
    closeTo(r.psd, [6.599999999999999, 13.2, 13.2, 13.2, 6.600000000000006]);
    expect(r.frequencies).toEqual([0, 1 / 8, 2 / 8, 3 / 8, 4 / 8]);
  });
  it('multiTaperPSD([1,2,3,4,5], { K: 2 }) has no zero bins', () => {
    closeTo(
      F.multiTaperPSD([1, 2, 3, 4, 5], { K: 2 }).psd,
      [
        15.235382907247956, 27.0256306709377, 8.399999999999999, 0.9743693290622941,
        0.3646170927520418,
      ]
    );
  });
  it('nfft 16 with five samples', () => {
    closeTo(
      F.multiTaperPSD([1, 2, 3, 4, 5], { nfft: 16, K: 2 }).psd,
      [
        15.235382907247956, 30.245073402431018, 27.025630670937705, 18.464528930162746,
        8.399999999999999, 2.44430224529411, 0.9743693290622945, 0.8460954221121182,
        0.3646170927520418,
      ]
    );
  });
  it('an odd nfft keeps the last bin at its one-sided value', () => {
    closeTo(
      F.multiTaperPSD([1, 2, 3, 4], { nfft: 5, K: 2 }).psd,
      [8.880127457812108, 13.21618627109395, 1.341186271093948]
    );
    closeTo(
      F.multiTaperPSD([1, 2, 3, 4, 5], { nfft: 7, K: 2 }).psd,
      [15.235382907247956, 25.077774931732954, 4.322187495034641, 0.8646546659844353]
    );
  });
  it('pin: a power-of-two length with the default nfft is unchanged', () => {
    expect(F.multiTaperPSD([1, 2, 3, 4]).psd).toEqual([3.75, 7.5, 3.75]);
  });
});

describe('#1145 multiTaperPSD above the WASM threshold (n = 5000, nfft = 8192)', () => {
  // Park-Miller noise (exact in doubles) on a sine and a period-7 ramp. Oracle: NumPy rfft,
  // K = 2 sine tapers, |X|^2 / n, interior bins doubled (.relay-sprint/scratch-worker/o_wasm.py).
  const signal = (): number[] => {
    let s = 12345;
    return Array.from({ length: 5000 }, (_, i) => {
      s = (s * 48271) % 2147483647;
      return Math.sin(0.3 * i) + (i % 7) / 7 + s / 2147483647;
    });
  };
  const wantEvery512 = [
    881.1025057815276, 0.036781471289829656, 0.04588642441680351, 0.12189693191457522,
    0.01649513768910557, 0.1340578149964709, 0.09931718821085721, 0.06183881010463253,
    0.002428334407558506,
  ];
  const check = (psd: number[]): void => {
    expect(psd).toHaveLength(4097);
    expect(psd.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
    for (let b = 0; b < wantEvery512.length; b++) {
      const got = psd[b * 512];
      expect(Math.abs(got - wantEvery512[b]) / wantEvery512[b], `bin ${b * 512}`).toBeLessThan(
        1e-9
      );
    }
    expect(Math.abs(psd[4096] - 0.002428334407558506) / 0.002428334407558506).toBeLessThan(1e-9);
  };
  it('matches NumPy on every 512th bin and fills the top half (JS path)', () => {
    check(F.multiTaperPSD(signal(), { K: 2 }).psd);
  });

  describe('with the AS kernel allowed at any size', () => {
    let restore: () => void = () => {};
    beforeAll(async () => {
      expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
      await F.loadWasm();
      restore = overrideWasmPolicy({ '*': { min: 0 } });
    });
    afterAll(() => restore());
    it('matches NumPy through the dispatch', () => {
      check(F.multiTaperPSD(signal(), { K: 2 }).psd);
    });
  });
});

describe('#1145 welchPSD and bartlettPSD with an odd frame length', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 7, 6, 10];
  it('the last bin is a one-sided bin, so it is doubled (rect, frame 5)', () => {
    closeTo(
      F.welchPSD(x, { frameLength: 5, overlap: 2, window: 'rect' }).psd,
      [132.2, 5.008514494500885, 23.791485505499118]
    );
  });
  it('the last bin is doubled (hann, frame 5)', () => {
    closeTo(
      F.welchPSD(x, { frameLength: 5, overlap: 2, window: 'hann' }).psd,
      [76.16666666666667, 79.9787137637478, 33.021286236252216]
    );
  });
  it('the last bin is doubled (rect, frame 7)', () => {
    closeTo(
      F.welchPSD(x, { frameLength: 7, overlap: 3, window: 'rect' }).psd,
      [146.28571428571428, 13.72280085736389, 4.70093872275245, 35.290546134169375]
    );
  });
  it('bartlettPSD doubles the last bin of an odd frame', () => {
    closeTo(
      F.bartlettPSD(x, { frameLength: 5 }).psd,
      [165.7, 11.61114561800017, 15.188854381999828]
    );
  });
  it('pin: an even frame keeps its Nyquist bin undoubled', () => {
    closeTo(
      F.welchPSD(x, { frameLength: 4, overlap: 2, window: 'rect' }).psd,
      [124.875, 3.750000000000001, 23.375]
    );
  });
});

describe('#1145 spectrogram of an empty signal', () => {
  it('returns no frames and no frequencies', () => {
    expect(F.spectrogram([])).toEqual({ magnitude: [], frequencies: [], times: [] });
  });
  it('pin: a short signal keeps its frequency axis', () => {
    expect(F.spectrogram([1, 2, 3, 4]).frequencies).toHaveLength(3);
  });
});
