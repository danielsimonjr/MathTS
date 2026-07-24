/**
 * Oracle tests for the wavelet-family extension (db1-4, sym2-4, coif1-2)
 * added to `dwt`/`idwt`/`wavedec`/`waverec`. All reference values were
 * regenerated with PyWavelets 1.8.0 (`pywt.dwt(x, name, mode='periodization')`,
 * `pywt.Wavelet(name).dec_lo` / `.dec_hi` / `.rec_lo` / `.rec_hi`) — see
 * `functions/src/signal/wavelet-filters.ts` for the derivation notes.
 */
import { describe, it, expect } from 'vitest';
import { dwt, idwt, wavedec, waverec } from '../src/index.js';
import { getWaveletFilters, SUPPORTED_WAVELETS } from '../src/signal/wavelet-filters.js';

const FAMILIES = ['haar', 'db1', 'db2', 'db3', 'db4', 'sym2', 'sym3', 'sym4', 'coif1', 'coif2'];

function expectArrayClose(actual: number[], expected: number[], tol: number) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThan(tol);
  }
}

// -----------------------------------------------------------------------------
// 1. Filter coefficients — pinned against pywt.Wavelet(name).{dec_lo,dec_hi,rec_lo,rec_hi}
// -----------------------------------------------------------------------------

const PYWT_FILTERS: Record<
  string,
  { decLo: number[]; decHi: number[]; recLo: number[]; recHi: number[] }
> = {
  haar: {
    decLo: [0.7071067811865476, 0.7071067811865476],
    decHi: [-0.7071067811865476, 0.7071067811865476],
    recLo: [0.7071067811865476, 0.7071067811865476],
    recHi: [0.7071067811865476, -0.7071067811865476],
  },
  db1: {
    decLo: [0.7071067811865476, 0.7071067811865476],
    decHi: [-0.7071067811865476, 0.7071067811865476],
    recLo: [0.7071067811865476, 0.7071067811865476],
    recHi: [0.7071067811865476, -0.7071067811865476],
  },
  db2: {
    decLo: [-0.12940952255126037, 0.2241438680420134, 0.8365163037378079, 0.48296291314453416],
    decHi: [-0.48296291314453416, 0.8365163037378079, -0.2241438680420134, -0.12940952255126037],
    recLo: [0.48296291314453416, 0.8365163037378079, 0.2241438680420134, -0.12940952255126037],
    recHi: [-0.12940952255126037, -0.2241438680420134, 0.8365163037378079, -0.48296291314453416],
  },
  db3: {
    decLo: [
      0.03522629188570953, -0.08544127388202666, -0.13501102001025458, 0.45987750211849154,
      0.8068915093110925, 0.33267055295008263,
    ],
    decHi: [
      -0.33267055295008263, 0.8068915093110925, -0.45987750211849154, -0.13501102001025458,
      0.08544127388202666, 0.03522629188570953,
    ],
    recLo: [
      0.33267055295008263, 0.8068915093110925, 0.45987750211849154, -0.13501102001025458,
      -0.08544127388202666, 0.03522629188570953,
    ],
    recHi: [
      0.03522629188570953, 0.08544127388202666, -0.13501102001025458, -0.45987750211849154,
      0.8068915093110925, -0.33267055295008263,
    ],
  },
  db4: {
    decLo: [
      -0.010597401785069032, 0.0328830116668852, 0.030841381835560764, -0.18703481171909309,
      -0.027983769416859854, 0.6308807679298589, 0.7148465705529157, 0.2303778133088965,
    ],
    decHi: [
      -0.2303778133088965, 0.7148465705529157, -0.6308807679298589, -0.027983769416859854,
      0.18703481171909309, 0.030841381835560764, -0.0328830116668852, -0.010597401785069032,
    ],
    recLo: [
      0.2303778133088965, 0.7148465705529157, 0.6308807679298589, -0.027983769416859854,
      -0.18703481171909309, 0.030841381835560764, 0.0328830116668852, -0.010597401785069032,
    ],
    recHi: [
      -0.010597401785069032, -0.0328830116668852, 0.030841381835560764, 0.18703481171909309,
      -0.027983769416859854, -0.6308807679298589, 0.7148465705529157, -0.2303778133088965,
    ],
  },
  sym2: {
    decLo: [-0.12940952255092145, 0.22414386804185735, 0.836516303737469, 0.48296291314469025],
    decHi: [-0.48296291314469025, 0.836516303737469, -0.22414386804185735, -0.12940952255092145],
    recLo: [0.48296291314469025, 0.836516303737469, 0.22414386804185735, -0.12940952255092145],
    recHi: [-0.12940952255092145, -0.22414386804185735, 0.836516303737469, -0.48296291314469025],
  },
  sym3: {
    decLo: [
      0.035226291882100656, -0.08544127388224149, -0.13501102001039084, 0.4598775021193313,
      0.8068915093133388, 0.3326705529509569,
    ],
    decHi: [
      -0.3326705529509569, 0.8068915093133388, -0.4598775021193313, -0.13501102001039084,
      0.08544127388224149, 0.035226291882100656,
    ],
    recLo: [
      0.3326705529509569, 0.8068915093133388, 0.4598775021193313, -0.13501102001039084,
      -0.08544127388224149, 0.035226291882100656,
    ],
    recHi: [
      0.035226291882100656, 0.08544127388224149, -0.13501102001039084, -0.4598775021193313,
      0.8068915093133388, -0.3326705529509569,
    ],
  },
  sym4: {
    decLo: [
      -0.07576571478927333, -0.02963552764599851, 0.49761866763201545, 0.8037387518059161,
      0.29785779560527736, -0.09921954357684722, -0.012603967262037833, 0.0322231006040427,
    ],
    decHi: [
      -0.0322231006040427, -0.012603967262037833, 0.09921954357684722, 0.29785779560527736,
      -0.8037387518059161, 0.49761866763201545, 0.02963552764599851, -0.07576571478927333,
    ],
    recLo: [
      0.0322231006040427, -0.012603967262037833, -0.09921954357684722, 0.29785779560527736,
      0.8037387518059161, 0.49761866763201545, -0.02963552764599851, -0.07576571478927333,
    ],
    recHi: [
      -0.07576571478927333, 0.02963552764599851, 0.49761866763201545, -0.8037387518059161,
      0.29785779560527736, 0.09921954357684722, -0.012603967262037833, -0.0322231006040427,
    ],
  },
  coif1: {
    decLo: [
      -0.015655728135791993, -0.07273261951252645, 0.3848648468648578, 0.8525720202116004,
      0.3378976624574818, -0.07273261951252645,
    ],
    decHi: [
      0.07273261951252645, 0.3378976624574818, -0.8525720202116004, 0.3848648468648578,
      0.07273261951252645, -0.015655728135791993,
    ],
    recLo: [
      -0.07273261951252645, 0.3378976624574818, 0.8525720202116004, 0.3848648468648578,
      -0.07273261951252645, -0.015655728135791993,
    ],
    recHi: [
      -0.015655728135791993, 0.07273261951252645, 0.3848648468648578, -0.8525720202116004,
      0.3378976624574818, 0.07273261951252645,
    ],
  },
  coif2: {
    decLo: [
      -0.000720549445520347, -0.0018232088709110323, 0.005611434819368834, 0.02368017194684777,
      -0.05943441864643109, -0.07648859907828076, 0.4170051844232391, 0.8127236354494135,
      0.3861100668227629, -0.0673725547237256, -0.04146493678687178, 0.01638733646320364,
    ],
    decHi: [
      -0.01638733646320364, -0.04146493678687178, 0.0673725547237256, 0.3861100668227629,
      -0.8127236354494135, 0.4170051844232391, 0.07648859907828076, -0.05943441864643109,
      -0.02368017194684777, 0.005611434819368834, 0.0018232088709110323, -0.000720549445520347,
    ],
    recLo: [
      0.01638733646320364, -0.04146493678687178, -0.0673725547237256, 0.3861100668227629,
      0.8127236354494135, 0.4170051844232391, -0.07648859907828076, -0.05943441864643109,
      0.02368017194684777, 0.005611434819368834, -0.0018232088709110323, -0.000720549445520347,
    ],
    recHi: [
      -0.000720549445520347, 0.0018232088709110323, 0.005611434819368834, -0.02368017194684777,
      -0.05943441864643109, 0.07648859907828076, 0.4170051844232391, -0.8127236354494135,
      0.3861100668227629, 0.0673725547237256, -0.04146493678687178, -0.01638733646320364,
    ],
  },
};

describe('wavelet filter coefficients (pywt 1.8.0 oracle)', () => {
  it('SUPPORTED_WAVELETS covers all 9 families (plus haar alias)', () => {
    for (const name of FAMILIES) {
      expect(SUPPORTED_WAVELETS).toContain(name);
    }
  });

  for (const name of FAMILIES) {
    it(`${name}: dec_lo/dec_hi/rec_lo/rec_hi match pywt`, () => {
      const filters = getWaveletFilters(name);
      const expected = PYWT_FILTERS[name];
      expectArrayClose(filters.decLo, expected.decLo, 1e-9);
      expectArrayClose(filters.decHi, expected.decHi, 1e-9);
      expectArrayClose(filters.recLo, expected.recLo, 1e-9);
      expectArrayClose(filters.recHi, expected.recHi, 1e-9);
    });
  }
});

// -----------------------------------------------------------------------------
// 2. Single-level dwt matches pywt periodization exactly
// -----------------------------------------------------------------------------

const X8 = [1, 2, 3, 4, 5, 6, 7, 8];

// pywt.dwt(X8, name, mode='periodization') for each family.
const PYWT_DWT_X8: Record<string, { cA: number[]; cD: number[] }> = {
  db2: {
    cA: [4.760278777324327, 3.7250025969142437, 6.553429721660434, 10.417133026816707],
    cD: [-1.035276180410083, 1.1102230246251565e-16, 4.440892098500626e-16, 3.8637033051562737],
  },
  db3: {
    cA: [8.85826275313406, 2.5701933797908483, 5.398620504537038, 8.628767485253766],
    cD: [0.9653405261418894, -4.85722573273506e-17, 1.942890293094024e-16, -3.7937676508880798],
  },
  db4: {
    cA: [11.202254807556493, 3.2648632244404854, 4.335047056996055, 6.653679033722678],
    cD: [-0.10111225293114769, -0.08477921428055193, 1.8430225064711718, 1.1712960854867185],
  },
  sym2: {
    cA: [4.760278777325942, 3.7250025969146097, 6.553429721660799, 10.417133026814362],
    cD: [-1.0352761804083617, -9.903744491168709e-13, -9.904299602681021e-13, 3.8637033051565317],
  },
  sym3: {
    cA: [8.858262753143636, 2.5701933797754615, 5.398620504521652, 8.628767485268968],
    cD: [0.9653405261197716, -9.616543672485989e-13, -6.9576566730233935e-12, -3.7937676509120095],
  },
  sym4: {
    cA: [2.212175101758009, 5.935190313215278, 9.111958351443313, 8.196520356301367],
    cD: [3.6119078439092887, -0.6061257183170858, 0.25778480482717947, -0.4351398056935589],
  },
  coif1: {
    cA: [3.5355339059327378, 4.242640687119285, 7.0710678118654755, 10.606601717798213],
    cD: [0.4566151310138759, 3.920475055707584e-16, 6.522560269672795e-16, -3.285042255760066],
  },
  coif2: {
    cA: [8.85106837779826, 2.0945902799312033, 5.76341152917451, 8.74677393581174],
    cD: [-0.6112039707881546, 0.18481144566370547, -0.08192664735336401, 3.3367462972240047],
  },
};

describe('single-level dwt matches pywt periodization', () => {
  for (const [name, expected] of Object.entries(PYWT_DWT_X8)) {
    it(`${name}`, () => {
      const { approx, detail } = dwt(X8, name);
      expectArrayClose(approx, expected.cA, 1e-8);
      expectArrayClose(detail, expected.cD, 1e-8);
    });
  }
});

// -----------------------------------------------------------------------------
// 3. Perfect reconstruction — implementation-independent oracle for EVERY family
// -----------------------------------------------------------------------------

describe('perfect reconstruction (waverec(wavedec(x)) === x)', () => {
  const x16 = [1, 3, -2, 5, 0, 4, 7, -1, 2, 6, -3, 8, 1, -4, 5, 9];

  for (const name of FAMILIES) {
    it(`${name}: level 1`, () => {
      const coeffs = wavedec(x16, name, 1);
      const back = waverec(coeffs, name);
      expectArrayClose(back, x16, 1e-10);
    });

    it(`${name}: level 2`, () => {
      const coeffs = wavedec(x16, name, 2);
      const back = waverec(coeffs, name);
      expectArrayClose(back, x16, 1e-10);
    });
  }
});

// -----------------------------------------------------------------------------
// 4. Vanishing moments — dbN/symN/coifN annihilate a sampled polynomial of
//    degree < (number of vanishing moments), away from the periodization
//    wrap boundary. Verified against pywt (N=48, margin=L/2+1) before pinning.
// -----------------------------------------------------------------------------

const VANISHING_MOMENTS: Record<string, number> = {
  db1: 1,
  db2: 2,
  db3: 3,
  db4: 4,
  sym2: 2,
  sym3: 3,
  sym4: 4,
  coif1: 2,
  coif2: 4,
};

describe('vanishing moments annihilate low-degree polynomials (interior)', () => {
  const N = 48;
  const t: number[] = Array.from({ length: N }, (_, i) => i);

  for (const [name, vm] of Object.entries(VANISHING_MOMENTS)) {
    const degree = vm - 1;
    it(`${name} (${vm} vanishing moments): degree-${degree} polynomial -> interior detail ~ 0`, () => {
      const poly = t.map((v) => Math.pow(v, degree));
      const { detail } = dwt(poly, name);
      const filters = getWaveletFilters(name);
      const margin = Math.floor(filters.decLo.length / 2) + 1;
      const interior = detail.slice(margin, detail.length - margin);
      expect(interior.length).toBeGreaterThan(0);
      for (const v of interior) {
        expect(Math.abs(v)).toBeLessThan(1e-6);
      }
    });
  }

  it('db2 pinned example: linear ramp interior details are exactly the pywt zeros', () => {
    // From the pinned db2 oracle above: cD = [-1.035..., 0, 0, 3.864...] for
    // x=[1..8] (a linear ramp) — the two interior entries are ~0.
    const { detail } = dwt(X8, 'db2');
    expect(Math.abs(detail[1])).toBeLessThan(1e-8);
    expect(Math.abs(detail[2])).toBeLessThan(1e-8);
  });
});

// -----------------------------------------------------------------------------
// 5. Haar/db1 regression — new filter-bank code reproduces the old hardcoded
//    2-tap Haar closed-form results bit-for-bit.
// -----------------------------------------------------------------------------

describe('Haar/db1 regression (matches the pre-existing closed-form behavior)', () => {
  it('dwt(haar) matches the closed-form s=1/sqrt(2) convention', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const { approx, detail } = dwt(x, 'haar');
    const s = 1 / Math.SQRT2;
    for (let i = 0; i < 4; i++) {
      expect(approx[i]).toBeCloseTo(s * (x[2 * i] + x[2 * i + 1]), 10);
      expect(detail[i]).toBeCloseTo(s * (x[2 * i] - x[2 * i + 1]), 10);
    }
  });

  it('idwt(haar) inverts dwt exactly as before', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const { approx, detail } = dwt(x, 'haar');
    const back = idwt(approx, detail, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });

  it('db1 produces identical results to haar', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const haar = dwt(x, 'haar');
    const db1 = dwt(x, 'db1');
    expectArrayClose(db1.approx, haar.approx, 1e-12);
    expectArrayClose(db1.detail, haar.detail, 1e-12);
  });

  it('waverec(wavedec(x, haar, 2)) still perfectly reconstructs (pre-existing test)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const coeffs = wavedec(x, 'haar', 2);
    const back = waverec(coeffs, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
});

// -----------------------------------------------------------------------------
// Unknown wavelet name
// -----------------------------------------------------------------------------

describe('unsupported wavelet name', () => {
  it('dwt throws a clear error listing supported families', () => {
    expect(() => dwt([1, 2, 3, 4], 'nonsense')).toThrow(/unsupported wavelet/i);
  });

  it('idwt throws a clear error listing supported families', () => {
    expect(() => idwt([1, 2], [0, 0], 'nonsense')).toThrow(/unsupported wavelet/i);
  });
});
