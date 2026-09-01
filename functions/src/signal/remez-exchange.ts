/**
 * Exact Parks-McClellan (Remez exchange) optimal equiripple FIR design.
 *
 * This is a faithful TypeScript port of the classic McClellan-Parks-Rabiner
 * FORTRAN program (via Erik Kvaleberg's `remez.c`), the same code SciPy wraps
 * in `scipy.signal.remez` (`_sigtoolsmodule.cc`: `pre_remez` + `remez`). It
 * replaces the earlier Lawson-IRLS approximation. Conventions match SciPy
 * exactly: band edges are normalized to `[0, 0.5]` (`fs = 1`, `0.5 = Nyquist`),
 * `desired`/`weight` carry one value per band (length `bands.length / 2`), and
 * `type` is `'bandpass'` (symmetric), `'differentiator'`, or `'hilbert'`
 * (antisymmetric). Coefficients are pinned against `scipy.signal.remez` in
 * `functions/tests/remez-pm.test.ts`.
 *
 * The port preserves the original's 1-based array indexing and control flow
 * (the extremal-search `goto` block is expressed as a small state machine) so
 * that it reproduces SciPy's discrete-grid extremal selection bit-for-bit.
 */

const PI = Math.PI;
const TWOPI = 2 * Math.PI;

export type RemezType = 'bandpass' | 'differentiator' | 'hilbert';

/** Lagrange interpolation coefficient (`d` in the original) for extremal `k`. */
function lagrangeInterp(k: number, n: number, m: number, x: number[]): number {
  let retval = 1.0;
  const q = x[k];
  for (let l = 1; l <= m; l++) {
    for (let j = l; j <= n; j += m) {
      if (j !== k) retval *= 2.0 * (q - x[j]);
    }
  }
  return 1.0 / retval;
}

/** Evaluate the response at grid point `k` via the barycentric Lagrange form (`gee`). */
function freqEval(
  k: number,
  n: number,
  grid: number[],
  x: number[],
  y: number[],
  ad: number[]
): number {
  let d = 0.0;
  let p = 0.0;
  const xf = Math.cos(TWOPI * grid[k]);
  for (let j = 1; j <= n; j++) {
    const c = ad[j] / (xf - x[j]);
    d += c;
    p += c * y[j];
  }
  return p / d;
}

/** Desired magnitude on the grid (`eff`): constant per band, or `∝ freq` for a differentiator. */
function eff(freq: number, fx: number[], lband: number, jtype: number): number {
  return jtype !== 2 ? fx[lband] : fx[lband] * freq;
}

/** Weight on the grid (`wate`). */
function wate(freq: number, fx: number[], wtx: number[], lband: number, jtype: number): number {
  if (jtype !== 2) return wtx[lband];
  if (fx[lband] >= 0.0001) return wtx[lband] / freq;
  return wtx[lband];
}

interface RemezResult {
  status: number; // 0 = ok, -1 = failed to converge
  dev: number;
  niter: number;
}

/**
 * Core Remez exchange over a prepared dense grid. Mutates `iext` (extremal grid
 * indices) and fills `alpha` (cosine-sum coefficients). Faithful port of the
 * FORTRAN `remez` subroutine, 1-based arrays throughout.
 */
function remezCore(
  des: number[],
  grid: number[],
  edge: number[],
  wt: number[],
  ngrid: number,
  nbands: number,
  iext: number[],
  alpha: number[],
  nfcns: number,
  itrmax: number
): RemezResult {
  const size = ngrid + 2 * nfcns + 8;
  const a = new Array<number>(size).fill(0);
  const p = new Array<number>(size).fill(0);
  const q = new Array<number>(size).fill(0);
  const ad = new Array<number>(size).fill(0);
  const x = new Array<number>(size).fill(0);
  const y = new Array<number>(size).fill(0);

  let devl = -1.0;
  const nz = nfcns + 1;
  const nzz = nfcns + 2;
  let niter = 0;
  let dev = 0.0;

  let comp = 0.0;
  let ynz = 0.0;
  let y1 = 0.0;
  let jchnge = 0;
  let k1 = 0;
  let knz = 0;
  let klow = 0;
  let nut = 0;
  let nut1 = 0;
  let nu = 0;
  let j = 0;
  let l = 0;
  let kup = 0;
  let luck = 0;
  let err = 0.0;

  // Unified state machine spanning the FORTRAN labels L100 (iteration top) and
  // L200..L370 (extremal search). `state` names the current label.
  let state = 100;
  let done = false; // reached coefficient-calculation section
  let failed = false; // dev <= devl "finished" early-return path

  outer: for (;;) {
    switch (state) {
      case 100: {
        iext[nzz] = ngrid + 1;
        ++niter;
        if (niter > itrmax) {
          done = true;
          break outer;
        }
        for (j = 1; j <= nz; j++) x[j] = Math.cos(grid[iext[j]] * TWOPI);
        const jet = Math.floor((nfcns - 1) / 15) + 1;
        for (j = 1; j <= nz; j++) ad[j] = lagrangeInterp(j, nz, jet, x);

        let dnum = 0.0;
        let dden = 0.0;
        let ksign = 1;
        for (j = 1; j <= nz; j++) {
          l = iext[j];
          dnum += ad[j] * des[l];
          dden += (ksign * ad[j]) / wt[l];
          ksign = -ksign;
        }
        dev = dnum / dden;

        nu = 1;
        if (dev > 0.0) nu = -1;
        dev = -nu * dev;
        ksign = nu;
        for (j = 1; j <= nz; j++) {
          l = iext[j];
          y[j] = des[l] + (ksign * dev) / wt[l];
          ksign = -ksign;
        }
        if (dev <= devl) {
          failed = true;
          break outer;
        }
        devl = dev;
        jchnge = 0;
        k1 = iext[1];
        knz = iext[nz];
        klow = 0;
        nut = -nu;
        j = 1;
        state = 200;
        continue;
      }
      case 200: {
        if (j === nzz) ynz = comp;
        if (j >= nzz) {
          state = 300;
          continue;
        }
        kup = iext[j + 1];
        l = iext[j] + 1;
        nut = -nut;
        if (j === 2) y1 = comp;
        comp = dev;
        if (l >= kup) {
          state = 220;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 220;
          continue;
        }
        comp = nut * err;
        state = 210;
        continue;
      }
      case 210: {
        if (++l >= kup) {
          state = 215;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 215;
          continue;
        }
        comp = nut * err;
        state = 210;
        continue;
      }
      case 215: {
        iext[j++] = l - 1;
        klow = l - 1;
        ++jchnge;
        state = 200;
        continue;
      }
      case 220: {
        --l;
        state = 225;
        continue;
      }
      case 225: {
        if (--l <= klow) {
          state = 250;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp > 0.0) {
          state = 230;
          continue;
        }
        if (jchnge <= 0) {
          state = 225;
          continue;
        }
        state = 260;
        continue;
      }
      case 230: {
        comp = nut * err;
        state = 235;
        continue;
      }
      case 235: {
        if (--l <= klow) {
          state = 240;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 240;
          continue;
        }
        comp = nut * err;
        state = 235;
        continue;
      }
      case 240: {
        klow = iext[j];
        iext[j] = l + 1;
        ++j;
        ++jchnge;
        state = 200;
        continue;
      }
      case 250: {
        l = iext[j] + 1;
        if (jchnge > 0) {
          state = 215;
          continue;
        }
        state = 255;
        continue;
      }
      case 255: {
        if (++l >= kup) {
          state = 260;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 255;
          continue;
        }
        comp = nut * err;
        state = 210;
        continue;
      }
      case 260: {
        klow = iext[j++];
        state = 200;
        continue;
      }
      case 300: {
        if (j > nzz) {
          state = 320;
          continue;
        }
        if (k1 > iext[1]) k1 = iext[1];
        if (knz < iext[nz]) knz = iext[nz];
        nut1 = nut;
        nut = -nu;
        l = 0;
        kup = k1;
        comp = ynz * 1.00001;
        luck = 1;
        state = 310;
        continue;
      }
      case 310: {
        if (++l >= kup) {
          state = 315;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 310;
          continue;
        }
        comp = nut * err;
        j = nzz;
        state = 210;
        continue;
      }
      case 315: {
        luck = 6;
        state = 325;
        continue;
      }
      case 320: {
        if (luck > 9) {
          state = 350;
          continue;
        }
        if (comp > y1) y1 = comp;
        k1 = iext[nzz];
        state = 325;
        continue;
      }
      case 325: {
        l = ngrid + 1;
        klow = knz;
        nut = -nut1;
        comp = y1 * 1.00001;
        state = 330;
        continue;
      }
      case 330: {
        if (--l <= klow) {
          state = 340;
          continue;
        }
        err = (freqEval(l, nz, grid, x, y, ad) - des[l]) * wt[l];
        if (nut * err - comp <= 0.0) {
          state = 330;
          continue;
        }
        j = nzz;
        comp = nut * err;
        luck = luck + 10;
        state = 235;
        continue;
      }
      case 340: {
        if (luck === 6) {
          state = 370;
          continue;
        }
        for (j = 1; j <= nfcns; j++) iext[nzz - j] = iext[nz - j];
        iext[1] = k1;
        state = 100;
        continue;
      }
      case 350: {
        const kn = iext[nzz];
        for (j = 1; j <= nfcns; j++) iext[j] = iext[j + 1];
        iext[nz] = kn;
        state = 100;
        continue;
      }
      case 370: {
        if (jchnge > 0) {
          state = 100;
          continue;
        }
        done = true;
        break outer;
      }
      default:
        break outer;
    }
  }

  if (failed) return { status: -1, dev, niter };
  if (!done) return { status: -1, dev, niter };

  // --- Coefficient calculation via the inverse DFT of the extremal set -------
  const nm1 = nfcns - 1;
  const fsh = 1.0e-6;
  const gtemp = grid[1];
  x[nzz] = -2.0;
  const cn = 2 * nfcns - 1;
  const delf = 1.0 / cn;
  l = 1;
  let kkk = 0;

  if (edge[1] === 0.0 && edge[2 * nbands] === 0.5) kkk = 1;
  if (nfcns <= 3) kkk = 1;

  let aa = 0.0;
  let bb = 0.0;
  if (kkk !== 1) {
    const dtemp = Math.cos(TWOPI * grid[1]);
    const dnum = Math.cos(TWOPI * grid[ngrid]);
    aa = 2.0 / (dtemp - dnum);
    bb = -(dtemp + dnum) / (dtemp - dnum);
  }

  for (j = 1; j <= nfcns; j++) {
    let ft = (j - 1) * delf;
    let xt = Math.cos(TWOPI * ft);
    if (kkk !== 1) {
      xt = (xt - bb) / aa;
      ft = Math.acos(xt) / TWOPI;
    }
    // Inner label L410..L425: locate xt among the extremal cosines x[].
    let assigned: boolean;
    for (;;) {
      const xe = x[l];
      if (xt > xe) {
        if (xt - xe < fsh) {
          a[j] = y[l];
          assigned = true;
          break;
        }
        grid[1] = ft;
        a[j] = freqEval(1, nz, grid, x, y, ad);
        assigned = true;
        break;
      }
      if (xe - xt < fsh) {
        a[j] = y[l];
        assigned = true;
        break;
      }
      ++l;
    }
    if (assigned && l > 1) l = l - 1;
  }

  grid[1] = gtemp;
  const dden = TWOPI / cn;
  for (j = 1; j <= nfcns; j++) {
    let dtemp = 0.0;
    const dnum = (j - 1) * dden;
    if (nm1 >= 1) {
      for (let k = 1; k <= nm1; k++) dtemp += a[k + 1] * Math.cos(dnum * k);
    }
    alpha[j] = 2.0 * dtemp + a[1];
  }

  for (j = 2; j <= nfcns; j++) alpha[j] *= 2.0 / cn;
  alpha[1] /= cn;

  if (kkk !== 1) {
    p[1] = 2.0 * alpha[nfcns] * bb + alpha[nm1];
    p[2] = 2.0 * aa * alpha[nfcns];
    q[1] = alpha[nfcns - 2] - alpha[nfcns];
    for (j = 2; j <= nm1; j++) {
      if (j >= nm1) {
        aa *= 0.5;
        bb *= 0.5;
      }
      p[j + 1] = 0.0;
      for (let k = 1; k <= j; k++) {
        a[k] = p[k];
        p[k] = 2.0 * bb * a[k];
      }
      p[2] += a[1] * 2.0 * aa;
      const jm1 = j - 1;
      for (let k = 1; k <= jm1; k++) p[k] += q[k] + aa * a[k + 1];
      const jp1 = j + 1;
      for (let k = 3; k <= jp1; k++) p[k] += aa * a[k - 1];
      if (j !== nm1) {
        for (let k = 1; k <= j; k++) q[k] = -a[k];
        q[1] += alpha[nfcns - 1 - j];
      }
    }
    for (j = 1; j <= nfcns; j++) alpha[j] = p[j];
  }

  if (nfcns <= 3) {
    alpha[nfcns + 1] = 0.0;
    alpha[nfcns + 2] = 0.0;
  }

  return { status: 0, dev, niter };
}

/**
 * Optimal equiripple FIR design (`scipy.signal.remez`) via the exact
 * Parks-McClellan / Remez exchange algorithm. `bands` is a flat list of band
 * edges normalized to `[0, 0.5]` (`fs = 1`, `0.5 = Nyquist`); `desired` and
 * `weight` carry one value per band (`bands.length / 2` entries). `type`
 * selects the linear-phase family (`'bandpass'` symmetric; `'differentiator'`
 * and `'hilbert'` antisymmetric). Returns `numtaps` FIR coefficients.
 */
export function remezExchange(
  numtaps: number,
  bands: readonly number[],
  desired: readonly number[],
  weight?: readonly number[],
  type: RemezType = 'bandpass',
  maxiter = 25,
  gridDensity = 16
): number[] {
  if (!Number.isInteger(numtaps) || numtaps < 1)
    throw new Error('remez: numtaps must be a positive integer');
  if (bands.length < 2 || bands.length % 2 !== 0)
    throw new Error('remez: bands must be a non-empty list of band-edge pairs');
  const numbands = bands.length / 2;
  if (desired.length !== numbands)
    throw new Error('remez: desired must have length bands.length / 2 (one value per band)');
  const w = weight ?? new Array<number>(numbands).fill(1);
  if (w.length !== numbands)
    throw new Error('remez: weight must have length bands.length / 2 (one value per band)');
  for (let i = 0; i < bands.length; i++) {
    if (!(bands[i] >= 0 && bands[i] <= 0.5))
      throw new Error('remez: band edges must be in [0, 0.5] (fs = 1, 0.5 = Nyquist)');
    if (i > 0 && bands[i] < bands[i - 1])
      throw new Error('remez: bands must be monotonically non-decreasing');
  }
  const jtype = type === 'bandpass' ? 1 : type === 'differentiator' ? 2 : 3;

  // 1-based working arrays (index 0 unused), mirroring pre_remez.
  const edge = [0, ...bands];
  const fx = [0, ...desired];
  const wtx = [0, ...w];

  const dimsize = Math.ceil(numtaps / 2.0 + 2);
  const wrksize = gridDensity * dimsize;

  const neg = jtype === 1 ? 0 : 1;
  const nodd = numtaps % 2;
  let nfcns = Math.floor(numtaps / 2);
  if (nodd === 1 && neg === 0) nfcns += 1;

  const des = new Array<number>(wrksize + 2).fill(0);
  const grid = new Array<number>(wrksize + 2).fill(0);
  const wt = new Array<number>(wrksize + 2).fill(0);
  const alpha = new Array<number>(dimsize + 3).fill(0);
  const iext = new Array<number>(dimsize + 3).fill(0);

  // --- Build the dense grid, desired, and weight ---------------------------
  let delf = gridDensity * nfcns;
  delf = 0.5 / delf;
  grid[1] = edge[1];
  if (neg !== 0 && edge[1] < delf) grid[1] = delf;

  let j = 1;
  let l = 1;
  let lband = 1;
  for (;;) {
    const fup = edge[l + 1];
    for (;;) {
      const temp = grid[j];
      des[j] = eff(temp, fx, lband, jtype);
      wt[j] = wate(temp, fx, wtx, lband, jtype);
      if (++j > wrksize) throw new Error('remez: grid too dense / too many points');
      grid[j] = temp + delf;
      if (grid[j] > fup) break;
    }
    grid[j - 1] = fup;
    des[j - 1] = eff(fup, fx, lband, jtype);
    wt[j - 1] = wate(fup, fx, wtx, lband, jtype);
    ++lband;
    l += 2;
    if (lband > numbands) break;
    grid[j] = edge[l];
  }

  let ngrid = j - 1;
  if (neg === nodd && grid[ngrid] > 0.5 - delf) --ngrid;

  if (ngrid < nfcns + 1)
    throw new Error('remez: band too narrow for the requested numtaps (grid underflow)');

  // --- Transform to the equivalent Type-I cosine problem -------------------
  if (neg <= 0) {
    if (nodd !== 1) {
      for (j = 1; j <= ngrid; j++) {
        const change = Math.cos(PI * grid[j]);
        des[j] = des[j] / change;
        wt[j] = wt[j] * change;
      }
    }
  } else {
    if (nodd !== 1) {
      for (j = 1; j <= ngrid; j++) {
        const change = Math.sin(PI * grid[j]);
        des[j] = des[j] / change;
        wt[j] = wt[j] * change;
      }
    } else {
      for (j = 1; j <= ngrid; j++) {
        const change = Math.sin(TWOPI * grid[j]);
        des[j] = des[j] / change;
        wt[j] = wt[j] * change;
      }
    }
  }

  // Initial guess: equally spaced extremal frequencies.
  const temp = (ngrid - 1) / nfcns;
  for (j = 1; j <= nfcns; j++) iext[j] = Math.floor((j - 1) * temp) + 1;
  iext[nfcns + 1] = ngrid;

  const res = remezCore(des, grid, edge, wt, ngrid, numbands, iext, alpha, nfcns, maxiter);
  if (res.status < 0) throw new Error('remez: Remez exchange failed to converge');

  // --- Map cosine coefficients back to the impulse response ----------------
  const h = new Array<number>(numtaps + 1).fill(0); // 1-based
  const nz = nfcns + 1;
  const nm1 = nfcns - 1;

  if (neg <= 0) {
    if (nodd !== 0) {
      for (j = 1; j <= nm1; j++) h[j] = 0.5 * alpha[nz - j];
      h[nfcns] = alpha[1];
    } else {
      h[1] = 0.25 * alpha[nfcns];
      for (j = 2; j <= nm1; j++) h[j] = 0.25 * (alpha[nz - j] + alpha[nfcns + 2 - j]);
      h[nfcns] = 0.5 * alpha[1] + 0.25 * alpha[2];
    }
  } else {
    if (nodd !== 0) {
      h[1] = 0.25 * alpha[nfcns];
      h[2] = 0.25 * alpha[nm1];
      for (j = 3; j <= nm1; j++) h[j] = 0.25 * (alpha[nz - j] - alpha[nfcns + 3 - j]);
      h[nfcns] = 0.5 * alpha[1] - 0.25 * alpha[3];
      h[nz] = 0.0;
    } else {
      h[1] = 0.25 * alpha[nfcns];
      for (j = 2; j <= nm1; j++) h[j] = 0.25 * (alpha[nz - j] - alpha[nfcns + 2 - j]);
      h[nfcns] = 0.5 * alpha[1] - 0.25 * alpha[2];
    }
  }

  for (j = 1; j <= nfcns; j++) {
    const k = numtaps + 1 - j;
    h[k] = neg === 0 ? h[j] : -h[j];
  }
  if (neg === 1 && nodd === 1) h[nz] = 0.0;

  return h.slice(1); // drop the 1-based padding
}
