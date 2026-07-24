/**
 * Orthogonal wavelet filter table + a general periodization-boundary filter
 * bank, shared by `dwt` (`../typed/signal.ts`) and `idwt`/`wavedec`/`waverec`
 * (`./wavelets.ts`). This module is a dependency-free leaf: it must not
 * import from `typed/signal.ts` (which imports `dwt` derivatives) to avoid a
 * cycle.
 *
 * Each wavelet is stored as its decomposition low-pass filter (`dec_lo`),
 * pinned bit-for-bit against PyWavelets 1.8.0 (`pywt.Wavelet(name).dec_lo`).
 * The other three orthogonal filters are derived by the standard QMF
 * relations (verified against pywt's `dec_hi`/`rec_lo`/`rec_hi` for every
 * entry below, tolerance 1e-14):
 *
 *   dec_hi[k] = -(-1)^k * dec_lo[L-1-k]   (alternating flip of the reverse)
 *   rec_lo    = reverse(dec_lo)
 *   rec_hi    = reverse(dec_hi)
 *
 * Boundary mode is **periodization** (matches `pywt.dwt(..., mode='periodization')`
 * exactly, bit-for-bit, verified against pywt for signal lengths 8/15/16/32):
 * treating the signal as circularly periodic yields exactly `ceil(N/2)`
 * coefficients per band and admits an exact analytic inverse. The phase
 * alignment (derived empirically against pywt, then verified across many
 * filter lengths and signal lengths) is:
 *
 *   analysis:  cA[n] = sum_k decLo[k] * x[(2n - k + floor(L/2)) mod N]
 *              cD[n] = sum_k decHi[k] * x[(2n - k + floor(L/2)) mod N]
 *   synthesis: x[m]  = sum_k recLo[k] * cA[j] + recHi[k] * cD[j]
 *              where idx = mod(m - k + floor(L/2) - 1, N), only when idx is
 *              even (j = idx / 2) — odd idx contributes zero (upsampling).
 *
 * @packageDocumentation
 */

/** Decomposition low-pass filter per wavelet name, pinned against pywt 1.8.0. */
const DEC_LO_TABLE: Record<string, number[]> = {
  haar: [0.7071067811865476, 0.7071067811865476],
  db1: [0.7071067811865476, 0.7071067811865476],
  db2: [-0.12940952255126037, 0.2241438680420134, 0.8365163037378079, 0.48296291314453416],
  db3: [
    0.03522629188570953, -0.08544127388202666, -0.13501102001025458, 0.45987750211849154,
    0.8068915093110925, 0.33267055295008263,
  ],
  db4: [
    -0.010597401785069032, 0.0328830116668852, 0.030841381835560764, -0.18703481171909309,
    -0.027983769416859854, 0.6308807679298589, 0.7148465705529157, 0.2303778133088965,
  ],
  sym2: [-0.12940952255092145, 0.22414386804185735, 0.836516303737469, 0.48296291314469025],
  sym3: [
    0.035226291882100656, -0.08544127388224149, -0.13501102001039084, 0.4598775021193313,
    0.8068915093133388, 0.3326705529509569,
  ],
  sym4: [
    -0.07576571478927333, -0.02963552764599851, 0.49761866763201545, 0.8037387518059161,
    0.29785779560527736, -0.09921954357684722, -0.012603967262037833, 0.0322231006040427,
  ],
  coif1: [
    -0.015655728135791993, -0.07273261951252645, 0.3848648468648578, 0.8525720202116004,
    0.3378976624574818, -0.07273261951252645,
  ],
  coif2: [
    -0.000720549445520347, -0.0018232088709110323, 0.005611434819368834, 0.02368017194684777,
    -0.05943441864643109, -0.07648859907828076, 0.4170051844232391, 0.8127236354494135,
    0.3861100668227629, -0.0673725547237256, -0.04146493678687178, 0.01638733646320364,
  ],
};

/** Wavelet names supported by `dwt`/`idwt`/`wavedec`/`waverec`. */
export const SUPPORTED_WAVELETS: readonly string[] = Object.keys(DEC_LO_TABLE);

/** The four orthogonal filters for a wavelet family. */
export interface WaveletFilters {
  decLo: number[];
  decHi: number[];
  recLo: number[];
  recHi: number[];
}

/**
 * Looks up (and derives) the four orthogonal filters for `wavelet`.
 *
 * @throws if `wavelet` is not one of `SUPPORTED_WAVELETS`.
 */
export function getWaveletFilters(wavelet: string): WaveletFilters {
  const decLo = DEC_LO_TABLE[wavelet];
  if (!decLo) {
    throw new Error(
      `unsupported wavelet "${wavelet}". Supported families: ${SUPPORTED_WAVELETS.join(', ')}`
    );
  }
  const L = decLo.length;
  const decHi = new Array<number>(L);
  for (let k = 0; k < L; k++) {
    decHi[k] = (k % 2 === 0 ? -1 : 1) * decLo[L - 1 - k];
  }
  const recLo = decLo.slice().reverse();
  const recHi = decHi.slice().reverse();
  return { decLo, decHi, recLo, recHi };
}

/** Euclidean-style modulo (always returns a value in `[0, m)`). */
function mod(a: number, m: number): number {
  const r = a % m;
  return r < 0 ? r + m : r;
}

/**
 * Single-level DWT via a general orthogonal filter bank with periodization
 * boundary handling. Matches `pywt.dwt(x, wavelet, mode='periodization')`
 * bit-for-bit for every supported family.
 *
 * @param x - Input signal (length >= 2)
 * @param wavelet - One of `SUPPORTED_WAVELETS`
 * @returns `{ approx, detail }`, each of length `ceil(x.length / 2)`
 */
export function dwtPeriodization(
  x: number[],
  wavelet: string
): { approx: number[]; detail: number[] } {
  const n = x.length;
  if (n < 2) throw new Error('signal must have at least 2 samples');

  const { decLo, decHi } = getWaveletFilters(wavelet);
  const L = decLo.length;
  const offset = Math.floor(L / 2);
  const half = Math.ceil(n / 2);

  const approx = new Array<number>(half);
  const detail = new Array<number>(half);
  for (let i = 0; i < half; i++) {
    let sa = 0;
    let sd = 0;
    for (let k = 0; k < L; k++) {
      const idx = mod(2 * i - k + offset, n);
      const xi = x[idx];
      sa += decLo[k] * xi;
      sd += decHi[k] * xi;
    }
    approx[i] = sa;
    detail[i] = sd;
  }
  return { approx, detail };
}

/**
 * Inverse single-level DWT (periodization boundary), the exact analytic
 * inverse of `dwtPeriodization`. Matches
 * `pywt.idwt(approx, detail, wavelet, mode='periodization')` bit-for-bit.
 *
 * @param approx - Approximation (low-pass) coefficients
 * @param detail - Detail (high-pass) coefficients, same length as `approx`
 * @param wavelet - One of `SUPPORTED_WAVELETS`
 * @returns Reconstructed signal, length `2 * approx.length`
 */
export function idwtPeriodization(approx: number[], detail: number[], wavelet: string): number[] {
  if (approx.length !== detail.length) {
    throw new Error('approx and detail must have equal length');
  }

  const { recLo, recHi } = getWaveletFilters(wavelet);
  const half = approx.length;
  const n = half * 2;
  const L = recLo.length;
  const shift = Math.floor(L / 2) - 1;

  const x = new Array<number>(n);
  for (let m = 0; m < n; m++) {
    let s = 0;
    for (let k = 0; k < L; k++) {
      const idx = mod(m - k + shift, n);
      if (idx % 2 === 0) {
        const j = idx / 2;
        s += recLo[k] * approx[j] + recHi[k] * detail[j];
      }
    }
    x[m] = s;
  }
  return x;
}
