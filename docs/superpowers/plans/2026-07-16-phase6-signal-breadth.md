# Phase 6 — Signal Processing Breadth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Fill the signal-processing gap — FFT helpers, IIR/FIR filter design, smoothing filters, wavelets, and spectral/peak analysis — all oracle-pinned vs scipy.signal / numpy.fft / pywt.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: scipy 1.17.1, numpy 2.3.4, pywt.

## Global Constraints

- Tests import built `dist/` — rebuild before vitest.
- **Oracle-pinned:** verify filter coefficients / transforms against scipy/numpy **at build time** (`python -c "..."`), hard-code confirmed values. Never round-trip.
- No new cross-package deps. Building blocks present: `fft`/`ifft`, `Complex` (core), existing `butter` (lowpass — has the zpk→bilinear→tf pipeline to reuse as a template, at `functions/src/signal-filter-extra.ts`), `lfilter`/`filtfilt`, `dct`/`dst`, `dwt`, `windowFunction`. Import from source modules.
- Additive & non-breaking. Where extending `butter`/`firwin`/`windowFunction`, keep existing signatures working (add optional args). strict + eslint zero. **New public exports → curated `docs/reference/functions.md` table** (docs-completeness gate) + `npm run docs:functions`/`docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms; commit may need explicit long timeout). Implementers commit locally, do NOT push.

## Verified current state

Missing: `rfft`/`irfft`/`fftshift`/`ifftshift`/`fftfreq`/`rfftfreq`/`fftn`; `cheby1`/`cheby2`/`ellip`/`besselFilter`; `sosfilt`/`tf2sos`/`zpk2sos`/`bilinear`/`buttord`/`firls`/`remez`; `savgol`/`wiener`/`deconvolve`; `csd`/`coherence`/`findPeaks`/`peakWidths`/`decimate`; `idwt`/`wavedec`/`waverec`/`cwt`/`stft`/`istft`. Present: `dct`/`idct`/`dst`, `resample`, `dwt`, `butter` (lowpass), `firwin` (scalar lowpass), `fft`/`ifft`, `welchPSD`, `windowFunction`, `lfilter`/`filtfilt`.

---

### Task 1: FFT helpers — `rfft`/`irfft`/`fftshift`/`ifftshift`/`fftfreq`/`rfftfreq`/`fftn`

**Files:** `functions/src/signal/fft-helpers.ts` (new); export the seven names. Test `functions/tests/fft-helpers.test.ts`.

**Spec** (reuse existing `fft`/`ifft` — find via `grep -rn "export.*\\bfft\\b" functions/src`):

- `rfft(x: number[]): { re: number[]; im: number[] }` — real FFT: full `fft(x)` then keep the first `floor(n/2)+1` bins. `irfft(spec, n): number[]` — inverse (reconstruct the conjugate-symmetric full spectrum then `ifft`, return real parts, length n).
- `fftshift(x: number[]): number[]` / `ifftshift(x)` — shift zero-frequency component to center / undo.
- `fftfreq(n, d=1): number[]` — DFT sample frequencies `[0,1,…,ceil(n/2)−1, −floor(n/2),…,−1]/(n·d)`. `rfftfreq(n, d=1)` — `[0,…,floor(n/2)]/(n·d)`.
- `fftn(x: number[][]): { re: number[][]; im: number[][] }` — 2-D FFT (FFT rows then columns).

**Oracles (numpy, VERIFIED):** `rfft([1,2,3,4])` → re `[10,−2,−2]`, im `[0,2,0]`. `fftfreq(4)` = `[0,0.25,−0.5,−0.25]`. `rfftfreq(4)` = `[0,0.25,0.5]`. `fftshift([0,1,2,3])` = `[2,3,0,1]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { rfft, irfft, fftshift, ifftshift, fftfreq, rfftfreq } from '../src/index.js';

describe('FFT helpers', () => {
  it('rfft([1,2,3,4]) = [10, -2+2i, -2]', () => {
    const s = rfft([1, 2, 3, 4]);
    expect(s.re.map((v) => Math.round(v))).toEqual([10, -2, -2]);
    expect(s.im.map((v) => Math.round(v))).toEqual([0, 2, 0]);
  });
  it('irfft(rfft(x)) round-trips', () => {
    const x = [1, 2, 3, 4, 5, 6];
    const back = irfft(rfft(x), x.length);
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
  it('fftfreq(4) = [0,0.25,-0.5,-0.25]', () => {
    expect(fftfreq(4)).toEqual([0, 0.25, -0.5, -0.25]);
  });
  it('rfftfreq(4) = [0,0.25,0.5]', () => {
    expect(rfftfreq(4)).toEqual([0, 0.25, 0.5]);
  });
  it('fftshift([0,1,2,3]) = [2,3,0,1] and ifftshift undoes it', () => {
    expect(fftshift([0, 1, 2, 3])).toEqual([2, 3, 0, 1]);
    expect(ifftshift(fftshift([0, 1, 2, 3, 4]))).toEqual([0, 1, 2, 3, 4]);
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(signal): FFT helpers rfft/irfft/fftshift/fftfreq/fftn`).

---

### Task 2: IIR filter design — `cheby1`/`cheby2`/`ellip` + `butter` high/band/stop + `bilinear`/`buttord` + `sosfilt`/`zpk2sos`

**Files:** extend `functions/src/signal-filter-extra.ts` (has the `butter` zpk→bilinear→tf pipeline to reuse) + a new `functions/src/signal/iir-design.ts`. Export `cheby1`, `cheby2`, `ellip`, `sosfilt`, `zpk2sos`, `bilinear`, `buttord`. **Also fix `butter` to honor a `btype`** ('low'|'high'|'bandpass'|'bandstop') as an optional 3rd/4th argument (default 'low' — the existing 2-arg lowpass call must stay identical). Test `functions/tests/iir-design.test.ts`.

**Spec:** analog prototype poles/zeros per filter type (Butterworth: existing; Chebyshev-I: poles on an ellipse from `rp` ripple; Chebyshev-II: poles+zeros from `rs` stopband; elliptic: Jacobi-elliptic poles/zeros from rp+rs — you may use the new `jacobiSN`/`ellipticK` from Phase 5). Frequency-transform the lowpass prototype to lp/hp/bp/bs, bilinear-transform to digital, convert zpk→tf (and `zpk2sos` → second-order sections). `sosfilt(sos, x)` applies cascaded biquads. `bilinear(b, a, fs)` bilinear-transforms an analog tf. `buttord(wp, ws, gpass, gstop)` → min order + natural freq.

**VERIFY every coefficient set against scipy at build time.** Oracles (scipy, VERIFIED):

- `cheby1(4, 1, 0.3)`: b[0]=`0.00836324`, a=`[1, −2.374123, 2.705657, −1.591709, 0.410315]`.
- `butter(2, 0.3, 'high')`: b=`[0.505001, −1.010002, 0.505001]`, a=`[1, −0.747789, 0.272215]`.

- [ ] **Step 1: failing test** (pin the two verified sets; add scipy-verified cheby2/ellip/bandpass cases you compute):

```ts
import { describe, it, expect } from 'vitest';
import { cheby1, butter, sosfilt, zpk2sos } from '../src/index.js';

const closeArr = (a: number[], b: number[], d = 5) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));

describe('IIR filter design', () => {
  it('cheby1(4,1,0.3) matches scipy', () => {
    const { b, a } = cheby1(4, 1, 0.3);
    expect(b[0]).toBeCloseTo(0.00836324, 6);
    closeArr(a, [1, -2.374123, 2.705657, -1.591709, 0.410315], 4);
  });
  it('butter(2,0.3) lowpass unchanged (2-arg call)', () => {
    const { b } = butter(2, 0.3);
    expect(b.length).toBe(3); // still works
  });
  it('butter(2,0.3,"high") matches scipy', () => {
    const { b, a } = butter(2, 0.3, 'high');
    closeArr(b, [0.505001, -1.010002, 0.505001], 4);
    closeArr(a, [1, -0.747789, 0.272215], 4);
  });
  it('sosfilt of a passthrough sos returns the input', () => {
    const sos = [[1, 0, 0, 1, 0, 0]]; // identity biquad
    expect(sosfilt(sos, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
```

- [ ] Steps 2–5. **Regression: existing butter/firwin/filter tests must stay green** (the 2-arg butter call is unchanged). (docs-completeness; CHANGELOG `### Added` cheby/ellip/sosfilt/etc + `### Fixed`/`### Changed` for butter btype; commit `feat(signal): Chebyshev/elliptic IIR design + butter btype + sosfilt`).

---

### Task 3: FIR + smoothing — `firwin` band/high + `firls`/`remez` + `savgol` + `wiener` + `deconvolve`

**Files:** `functions/src/signal/fir-smoothing.ts` (new); extend `firwin` (or add `firwinBandpass`). Export `firls`, `remez`, `savgol`, `wiener`, `deconvolve` + the firwin band/high capability. Test `functions/tests/fir-smoothing.test.ts`.

**Spec:**

- Extend `firwin` to accept a **band** cutoff (array of two) and a `pass_zero`/`btype` option — OR add `firwinBandpass(numtaps, [f1,f2])`. Keep the existing scalar-lowpass `firwin(numtaps, cutoff)` identical.
- `savgol(x, windowLength, polyorder): number[]` — Savitzky–Golay smoothing (least-squares polynomial fit over a sliding odd window; precompute the SG coefficients via the Vandermonde pseudo-inverse). Exact on polynomials of degree ≤ polyorder.
- `wiener(x, mysize?): number[]` — Wiener adaptive filter (local mean/variance smoothing).
- `deconvolve(signal, divisor): { quotient: number[]; remainder: number[] }` — polynomial/FIR deconvolution (long division).
- `firls(numtaps, bands, desired)` and `remez(numtaps, bands, desired)` — least-squares / Parks–McClellan FIR design (remez may be approximate; document).

**Oracle (VERIFIED):** `savgol([1,2,3,4,5,6,7], 5, 2)` = `[1,2,3,4,5,6,7]` (exact on a linear ramp).

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { savgol, deconvolve } from '../src/index.js';

describe('FIR + smoothing', () => {
  it('savgol is exact on a linear ramp', () => {
    savgol([1, 2, 3, 4, 5, 6, 7], 5, 2).forEach((v, i) => expect(v).toBeCloseTo(i + 1, 8));
  });
  it('savgol smooths noise but preserves a quadratic (order 2)', () => {
    const q = [0, 1, 4, 9, 16, 25, 36]; // x^2
    savgol(q, 5, 2).forEach((v, i) => expect(v).toBeCloseTo(q[i], 6));
  });
  it('deconvolve inverts convolution', () => {
    // (1,2,3) conv (1,1) = (1,3,5,3); deconvolve -> quotient (1,2,3), zero remainder
    const r = deconvolve([1, 3, 5, 3], [1, 1]);
    r.quotient.forEach((v, i) => expect(v).toBeCloseTo([1, 2, 3][i], 8));
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(signal): firwin bandpass + firls/remez + savgol/wiener/deconvolve`).

---

### Task 4: wavelets — `idwt`/`wavedec`/`waverec`/`cwt`

**Files:** `functions/src/signal/wavelets.ts` (new); export `idwt`, `wavedec`, `waverec`, `cwt`. Test `functions/tests/wavelets.test.ts`.

**Spec** (reuse the existing `dwt` — find it; match its wavelet-family convention, likely Haar/`db*`):

- `idwt(cA, cD, wavelet): number[]` — inverse single-level DWT (upsample + reconstruction filters), the inverse of `dwt`.
- `wavedec(x, wavelet, level): number[][]` — multilevel DWT: `[cA_n, cD_n, cD_{n−1}, …, cD_1]`.
- `waverec(coeffs, wavelet): number[]` — multilevel reconstruction (inverse of wavedec).
- `cwt(x, scales, wavelet): number[][]` — continuous wavelet transform (e.g. Ricker/Morlet) over the given scales.

**Oracle:** `waverec(wavedec(x, 'haar', 2), 'haar')` reconstructs `x` (perfect reconstruction). `idwt(...dwt(x,'haar'), 'haar')` = x.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { dwt, idwt, wavedec, waverec } from '../src/index.js';

describe('wavelets', () => {
  it('idwt inverts dwt (haar)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const [cA, cD] = dwt(x, 'haar');
    const back = idwt(cA, cD, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
  it('waverec perfectly reconstructs wavedec (haar, 2 levels)', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const coeffs = wavedec(x, 'haar', 2);
    const back = waverec(coeffs, 'haar');
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
});
```

(Read `dwt`'s actual return shape/signature first — adjust the test's destructuring to match.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(signal): idwt/wavedec/waverec/cwt wavelet transforms`).

---

### Task 5: spectral + peaks — `csd`/`coherence`/`findPeaks`/`peakWidths`/`stft`/`istft`/`decimate`

**Files:** `functions/src/signal/spectral-peaks.ts` (new); export the seven names. Test `functions/tests/spectral-peaks.test.ts`.

**Spec:**

- `findPeaks(x, opts?: { height?; distance?; prominence? }): number[]` — indices of local maxima with optional height/distance/prominence filtering.
- `peakWidths(x, peaks, relHeight=0.5): number[]` — width of each peak at the given relative height.
- `csd(x, y, opts?)` / `coherence(x, y, opts?)` — cross-spectral density / magnitude-squared coherence (Welch-style; reuse the existing `welchPSD` machinery).
- `stft(x, opts)` / `istft(...)` — short-time Fourier transform + inverse (windowed frames via existing `fft`/`windowFunction`).
- `decimate(x, q): number[]` — downsample by integer q (anti-alias filter then take every q-th; reuse a lowpass).

**Oracle (VERIFIED):** `findPeaks([0,2,0,3,0,1,0])` = `[1,3,5]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { findPeaks, peakWidths, stft, istft } from '../src/index.js';

describe('spectral + peaks', () => {
  it('findPeaks([0,2,0,3,0,1,0]) = [1,3,5]', () => {
    expect(findPeaks([0, 2, 0, 3, 0, 1, 0])).toEqual([1, 3, 5]);
  });
  it('findPeaks with height filter drops small peaks', () => {
    expect(findPeaks([0, 2, 0, 3, 0, 1, 0], { height: 2.5 })).toEqual([3]);
  });
  it('peakWidths returns a width per peak', () => {
    const w = peakWidths([0, 1, 3, 1, 0], [2]);
    expect(w).toHaveLength(1);
    expect(w[0]).toBeGreaterThan(0);
  });
  it('istft inverts stft (perfect reconstruction on a simple signal)', () => {
    const x = Array.from({ length: 64 }, (_, i) => Math.sin(i / 3));
    const S = stft(x, { nperseg: 16 });
    const back = istft(S, { nperseg: 16 });
    // COLA reconstruction: compare the stable middle region
    for (let i = 20; i < 44; i++) expect(back[i]).toBeCloseTo(x[i], 4);
  });
});
```

(Adjust `stft`/`istft` option names to your implementation; ensure COLA — constant-overlap-add — so istft reconstructs.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(signal): csd/coherence/findPeaks/peakWidths/stft/istft/decimate`).

---

## Release (after all 5 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize the signal additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish` (wait for propagation), push tags, **verify** via `npm view` + clean-install probe of `rfft`/`cheby1`/`butter('high')`/`savgol`/`findPeaks`.
- [ ] Tick TODO Phase 6 (and the Phase-0-deferred butter/firwin band items); footnote roadmap; phase-boundary check-in; then Phase 7.

## Self-Review

- Task 2 extends `butter` (keep 2-arg lowpass identical) and Task 3 extends `firwin` (keep scalar-lowpass identical) — these resolve the butter/firwin _features_ deferred from Phase 0. Existing tests must stay green.
- Every filter coefficient set oracle-pinned to scipy, verified at build time. remez/cwt may be approximate — document.
