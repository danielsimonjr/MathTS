/**
 * Peak detection/width analysis, cross-spectral density + coherence, short-time
 * Fourier transform (+ inverse), and anti-aliased decimation — vs `scipy.signal`.
 *
 * Reuses the package's own object-array FFT (`fft`/`ifft`/`ifftReal` from
 * `./fft.js` — the same internal FFT `./conv.ts` already builds on), the shared
 * `windowFunction` (`../typed/signal.js`), and the existing Butterworth +
 * zero-phase filter pipeline (`butter`/`filtfilt` from `../signal-filter-extra.js`)
 * for the anti-alias lowpass in `decimate`.
 *
 * @packageDocumentation
 */
import { fft, ifftReal, type ComplexNumber } from './fft.js';
import { windowFunction } from '../typed/signal.js';
import { butter, filtfilt } from '../signal-filter-extra.js';

// =============================================================================
// Peak detection
// =============================================================================

/** Options for {@link findPeaks}. */
export interface FindPeaksOptions {
  /** Minimum peak value to keep. */
  height?: number;
  /** Minimum index separation between kept peaks (greedily keeps the taller peak). */
  distance?: number;
  /** Minimum topographic prominence to keep (see {@link peakWidths} for the definition). */
  prominence?: number;
}

/**
 * Topographic prominence of the peak at index `i`: how much the peak stands out from
 * the surrounding baseline, found by extending outward from the peak in each direction
 * until either a taller sample or the array boundary is reached, tracking the minimum
 * sample seen along the way, then taking the *higher* of the two direction minima as
 * the peak's base. Matches `scipy.signal.peak_prominences`'s single-peak case.
 */
function peakProminence(x: readonly number[], i: number): number {
  const n = x.length;
  const peakHeight = x[i];

  let leftMin = peakHeight;
  let j = i;
  while (j > 0) {
    j--;
    if (x[j] > peakHeight) break;
    if (x[j] < leftMin) leftMin = x[j];
  }

  let rightMin = peakHeight;
  let k = i;
  while (k < n - 1) {
    k++;
    if (x[k] > peakHeight) break;
    if (x[k] < rightMin) rightMin = x[k];
  }

  return peakHeight - Math.max(leftMin, rightMin);
}

/**
 * Greedily thin `peaks` so no two survivors are closer than `distance` samples apart,
 * always keeping the taller of any two conflicting peaks — `scipy.signal.find_peaks`'s
 * `distance` filter. Processes peaks from tallest to shortest, removing any
 * not-yet-removed neighbor within `distance`.
 */
function filterByDistance(x: readonly number[], peaks: number[], distance: number): number[] {
  const order = peaks.map((_, idx) => idx).sort((a, b) => x[peaks[b]] - x[peaks[a]]);
  const keep = new Array<boolean>(peaks.length).fill(true);

  for (const idx of order) {
    if (!keep[idx]) continue;
    let j = idx - 1;
    while (j >= 0 && peaks[idx] - peaks[j] < distance) {
      keep[j] = false;
      j--;
    }
    let k = idx + 1;
    while (k < peaks.length && peaks[k] - peaks[idx] < distance) {
      keep[k] = false;
      k++;
    }
  }

  return peaks.filter((_, idx) => keep[idx]);
}

/**
 * Find strict local-maxima peak indices in `x` (`x[i-1] < x[i] > x[i+1]`), then
 * optionally filter by minimum `height`, minimum index `distance` (greedily keeping
 * the taller peak of any too-close pair), and/or minimum topographic `prominence` —
 * `scipy.signal.find_peaks`.
 *
 * @param x - Input signal
 * @param opts - `{ height?, distance?, prominence? }`
 * @returns Ascending indices of the surviving peaks
 */
export function findPeaks(x: readonly number[], opts?: FindPeaksOptions): number[] {
  let peaks: number[] = [];
  for (let i = 1; i < x.length - 1; i++) {
    if (x[i - 1] < x[i] && x[i] > x[i + 1]) peaks.push(i);
  }

  if (opts?.height !== undefined) {
    const h = opts.height;
    peaks = peaks.filter((i) => x[i] >= h);
  }
  if (opts?.prominence !== undefined) {
    const p = opts.prominence;
    peaks = peaks.filter((i) => peakProminence(x, i) >= p);
  }
  if (opts?.distance !== undefined && peaks.length > 1) {
    peaks = filterByDistance(x, peaks, opts.distance);
  }

  return peaks;
}

/**
 * Linear-interpolated crossing point of `refHeight`, walking from `start` in direction
 * `dir` (-1 left, +1 right) while `x` stays above `refHeight`. Returns the fractional
 * index of the crossing (or the boundary index if `refHeight` is never crossed).
 */
function interpolateCrossing(
  x: readonly number[],
  start: number,
  dir: -1 | 1,
  refHeight: number
): number {
  const n = x.length;
  let j = start;
  while (j + dir >= 0 && j + dir < n && x[j + dir] > refHeight) j += dir;
  const j2 = j + dir;
  if (j2 < 0 || j2 >= n) return j;
  const v1 = x[j];
  const v2 = x[j2];
  if (v1 === v2) return j;
  const frac = (v1 - refHeight) / (v1 - v2);
  return j + dir * frac;
}

/**
 * Width (in samples) of each peak at `relHeight` down from the peak toward its
 * topographic base (see {@link peakProminence}), with linearly-interpolated crossing
 * points — `scipy.signal.peak_widths`.
 *
 * @param x - Input signal
 * @param peaks - Peak indices (e.g. from {@link findPeaks})
 * @param relHeight - Fraction of the prominence to descend (default 0.5, i.e. FWHM-style)
 * @returns Width per peak, same order as `peaks`
 */
export function peakWidths(
  x: readonly number[],
  peaks: readonly number[],
  relHeight = 0.5
): number[] {
  return peaks.map((i) => {
    const prom = peakProminence(x, i);
    const refHeight = x[i] - relHeight * prom;
    const left = interpolateCrossing(x, i, -1, refHeight);
    const right = interpolateCrossing(x, i, 1, refHeight);
    return right - left;
  });
}

// =============================================================================
// Cross-spectral density + coherence (Welch averaging)
// =============================================================================

/** Options shared by {@link csd} and {@link coherence}. */
export interface CsdOptions {
  /** Segment length (default `min(256, x.length, y.length)`). */
  nperseg?: number;
  /** Samples of overlap between segments (default `floor(nperseg/2)`). */
  noverlap?: number;
  /** Window applied to each segment (default `'hann'`) — see {@link windowFunction}. */
  window?: string;
  /** Sample rate in Hz, used to scale frequencies and power (default 1). */
  fs?: number;
}

/** Windowed, non-overlapping-checked segment FFTs of `sig` for Welch averaging. */
function segmentSpectra(
  sig: readonly number[],
  nperseg: number,
  noverlap: number,
  winType: string
): { segments: ComplexNumber[][]; winSum2: number } {
  const step = nperseg - noverlap;
  if (step <= 0) throw new Error('csd/coherence: noverlap must be less than nperseg');
  const win = windowFunction(nperseg, winType);
  const winSum2 = win.reduce((s, w) => s + w * w, 0);

  const segments: ComplexNumber[][] = [];
  for (let start = 0; start + nperseg <= sig.length; start += step) {
    const seg = new Array<number>(nperseg);
    for (let i = 0; i < nperseg; i++) seg[i] = sig[start + i] * win[i];
    segments.push(fft(seg).spectrum);
  }
  if (segments.length === 0) {
    throw new Error(`csd/coherence: signal length ${sig.length} shorter than nperseg ${nperseg}`);
  }
  return { segments, winSum2 };
}

/** Welch-averaged cross power spectrum `X·conj(Y)` (re/im), plus its frequency bins. */
function crossPower(
  x: readonly number[],
  y: readonly number[],
  opts?: CsdOptions
): { frequencies: number[]; re: number[]; im: number[] } {
  const nperseg = opts?.nperseg ?? Math.min(256, x.length, y.length);
  const noverlap = opts?.noverlap ?? Math.floor(nperseg / 2);
  const winType = opts?.window ?? 'hann';
  const fs = opts?.fs ?? 1;

  const { segments: Xs, winSum2 } = segmentSpectra(x, nperseg, noverlap, winType);
  const { segments: Ys } = segmentSpectra(y, nperseg, noverlap, winType);
  const nSeg = Math.min(Xs.length, Ys.length);
  const nfft = Xs[0].length;
  const half = Math.floor(nfft / 2) + 1;

  const re = new Array<number>(half).fill(0);
  const im = new Array<number>(half).fill(0);
  for (let s = 0; s < nSeg; s++) {
    for (let k = 0; k < half; k++) {
      const X = Xs[s][k];
      const Y = Ys[s][k];
      re[k] += X.re * Y.re + X.im * Y.im;
      im[k] += X.im * Y.re - X.re * Y.im;
    }
  }

  const scale = 1 / (fs * winSum2 * nSeg);
  for (let k = 0; k < half; k++) {
    re[k] *= scale;
    im[k] *= scale;
  }

  const frequencies = Array.from({ length: half }, (_, k) => (k * fs) / nfft);
  return { frequencies, re, im };
}

/**
 * Cross-spectral density of `x` and `y` via Welch's overlapped-segment-averaging
 * method (segment, window, FFT, average `X·conj(Y)`) — `scipy.signal.csd`.
 *
 * @param x - First signal
 * @param y - Second signal
 * @param opts - `{ nperseg?, noverlap?, window?, fs? }`
 * @returns `{ frequencies, power }` — `power` is the magnitude of the averaged
 *   cross spectrum at each frequency bin
 */
export function csd(
  x: readonly number[],
  y: readonly number[],
  opts?: CsdOptions
): { frequencies: number[]; power: number[] } {
  const { frequencies, re, im } = crossPower(x, y, opts);
  const power = re.map((r, k) => Math.hypot(r, im[k]));
  return { frequencies, power };
}

/**
 * Magnitude-squared coherence between `x` and `y`: `|Pxy|² / (Pxx·Pyy)`, per Welch
 * frequency bin — `scipy.signal.coherence`. Values lie in `[0, 1]`.
 *
 * @param x - First signal
 * @param y - Second signal
 * @param opts - `{ nperseg?, noverlap?, window?, fs? }`
 * @returns `{ frequencies, coherence }`
 */
export function coherence(
  x: readonly number[],
  y: readonly number[],
  opts?: CsdOptions
): { frequencies: number[]; coherence: number[] } {
  const pxy = crossPower(x, y, opts);
  const pxx = crossPower(x, x, opts);
  const pyy = crossPower(y, y, opts);

  const coh = pxy.re.map((r, k) => {
    const num = r * r + pxy.im[k] * pxy.im[k];
    const den = pxx.re[k] * pyy.re[k]; // auto-spectra are real (im ~ 0 up to fp noise)
    if (den <= 0) return 0;
    return Math.min(1, num / den);
  });

  return { frequencies: pxy.frequencies, coherence: coh };
}

// =============================================================================
// Short-time Fourier transform + inverse (overlap-add, COLA-normalized)
// =============================================================================

/** Options for {@link stft} / {@link istft} — must match between the two calls. */
export interface StftOptions {
  /** Frame length (default 256). */
  nperseg?: number;
  /** Samples of overlap between frames (default `floor(nperseg/2)`). */
  noverlap?: number;
  /** Window applied to each frame (default `'hann'`) — see {@link windowFunction}. */
  window?: string;
}

/** `stft`'s output: one row per frame, one column per (non-redundant-truncated) frequency bin. */
export interface StftResult {
  re: number[][];
  im: number[][];
}

/**
 * Short-time Fourier transform: windowed, overlapping frames, each FFT'd independently
 * — `scipy.signal.stft` (magnitude/phase convention; frames are not scaled).
 *
 * @param x - Input signal
 * @param opts - `{ nperseg?, noverlap?, window? }`
 * @returns `{ re, im }`, each `number[frame][bin]`
 */
export function stft(x: readonly number[], opts?: StftOptions): StftResult {
  const nperseg = opts?.nperseg ?? 256;
  const noverlap = opts?.noverlap ?? Math.floor(nperseg / 2);
  const winType = opts?.window ?? 'hann';
  const step = nperseg - noverlap;
  if (step <= 0) throw new Error('stft: noverlap must be less than nperseg');

  const win = windowFunction(nperseg, winType);
  const re: number[][] = [];
  const im: number[][] = [];

  for (let start = 0; start + nperseg <= x.length; start += step) {
    const seg = new Array<number>(nperseg);
    for (let i = 0; i < nperseg; i++) seg[i] = x[start + i] * win[i];
    const spectrum = fft(seg).spectrum;
    re.push(spectrum.map((c) => c.re));
    im.push(spectrum.map((c) => c.im));
  }

  return { re, im };
}

/**
 * Inverse short-time Fourier transform via overlap-add: each frame is inverse-FFT'd
 * back to `nperseg` samples, re-windowed, and accumulated; the accumulation is
 * normalized by the running sum of squared window values (the standard
 * constant-overlap-add / COLA normalization), so reconstruction is exact in the
 * interior wherever the window's overlap sum is nonzero — `scipy.signal.istft`.
 *
 * @param S - `{ re, im }` as returned by {@link stft}
 * @param opts - `{ nperseg?, noverlap?, window? }` — must match the `stft` call
 * @returns Reconstructed signal
 */
export function istft(S: StftResult, opts?: StftOptions): number[] {
  const nperseg = opts?.nperseg ?? 256;
  const noverlap = opts?.noverlap ?? Math.floor(nperseg / 2);
  const winType = opts?.window ?? 'hann';
  const step = nperseg - noverlap;
  if (step <= 0) throw new Error('istft: noverlap must be less than nperseg');

  const win = windowFunction(nperseg, winType);
  const nFrames = S.re.length;
  const outLength = nFrames > 0 ? (nFrames - 1) * step + nperseg : 0;

  const output = new Array<number>(outLength).fill(0);
  const normalizer = new Array<number>(outLength).fill(0);

  for (let f = 0; f < nFrames; f++) {
    const spectrum: ComplexNumber[] = S.re[f].map((r, i) => ({ re: r, im: S.im[f][i] }));
    const frame = ifftReal(spectrum, nperseg);
    const start = f * step;
    for (let i = 0; i < nperseg; i++) {
      output[start + i] += frame[i] * win[i];
      normalizer[start + i] += win[i] * win[i];
    }
  }

  for (let i = 0; i < outLength; i++) {
    if (normalizer[i] > 1e-12) output[i] /= normalizer[i];
  }

  return output;
}

// =============================================================================
// Decimation (anti-aliased downsampling)
// =============================================================================

/**
 * Downsample `x` by an integer factor `q`: apply a Butterworth anti-alias lowpass
 * (order 4, cutoff `min(0.8/q, 0.99)` of Nyquist) with zero-phase `filtfilt`, then
 * take every `q`-th sample — `scipy.signal.decimate` (IIR mode).
 *
 * @param x - Input signal
 * @param q - Downsampling factor (positive integer)
 * @returns Downsampled signal, length `ceil(x.length / q)`
 */
export function decimate(x: readonly number[], q: number): number[] {
  if (!Number.isInteger(q) || q < 1) {
    throw new Error('decimate: q must be a positive integer');
  }
  if (q === 1) return x.slice();

  const order = 4;
  const wn = Math.min(0.8 / q, 0.99);
  const { b, a } = butter(order, wn);
  const filtered = filtfilt(b, a, x);

  const out: number[] = [];
  for (let i = 0; i < filtered.length; i += q) out.push(filtered[i]);
  return out;
}
