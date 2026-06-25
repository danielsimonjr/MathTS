//! Special mathematical functions: erf, gamma, zeta, bessel, etc.
//! Uses statrs for gamma/erf where available, with manual implementations for others.

use core::f64::consts::PI;

// Lanczos coefficients for gamma function
const LANCZOS_G: f64 = 7.0;
const LANCZOS_C: [f64; 9] = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
];

/// Error function erf(x).
#[no_mangle]
pub extern "C" fn erf(x: f64) -> f64 {
    statrs::function::erf::erf(x)
}

/// Compute erf for an array.
#[no_mangle]
pub unsafe extern "C" fn erfArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = erf(*a_ptr.add(i));
    }
}

/// Complementary error function erfc(x).
/// For the tail (x >= 1.5) uses the Abramowitz & Stegun 7.1.14 continued
/// fraction (modified Lentz) directly — no 1 - erf cancellation — giving
/// ~f64 accuracy in place of the legacy 7.1.26 rational (~1e-7).
#[no_mangle]
pub extern "C" fn erfc(x: f64) -> f64 {
    if x != x {
        return f64::NAN;
    }
    if x < 0.0 {
        return 2.0 - erfc(-x);
    }
    if x < 1.5 {
        // erfc ~ O(1) here, so 1 - erf loses no significant figures (erf is the
        // accurate statrs implementation).
        return 1.0 - erf(x);
    }
    let tiny = 1e-300_f64;
    let a = x;
    let mut f = if a < tiny { tiny } else { a };
    let mut c = f;
    let mut d = 0.0_f64;
    let mut i = 1_i32;
    while i <= 300 {
        let ai = i as f64 / 2.0;
        d = a + ai * d;
        if d == 0.0 {
            d = tiny;
        }
        d = 1.0 / d;
        c = a + ai / c;
        if c == 0.0 {
            c = tiny;
        }
        let delta = c * d;
        f *= delta;
        if libm::fabs(delta - 1.0) < 1e-16 {
            break;
        }
        i += 1;
    }
    libm::exp(-a * a) / libm::sqrt(PI) / f
}

/// Compute erfc for an array.
#[no_mangle]
pub unsafe extern "C" fn erfcArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = erfc(*a_ptr.add(i));
    }
}

/// Gamma function using Lanczos approximation.
#[no_mangle]
pub extern "C" fn gamma(x: f64) -> f64 {
    if x != x {
        return f64::NAN;
    }
    if x < 0.5 {
        return PI / (libm::sin(PI * x) * gamma(1.0 - x));
    }
    let x = x - 1.0;
    let t = x + LANCZOS_G + 0.5;
    let mut a = LANCZOS_C[0];
    for i in 1..9 {
        a += LANCZOS_C[i] / (x + i as f64);
    }
    core::f64::consts::SQRT_2 * 1.7724538509055159 * libm::pow(t, x + 0.5) * libm::exp(-t) * a
}

/// Compute gamma for an array.
#[no_mangle]
pub unsafe extern "C" fn gammaArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = gamma(*a_ptr.add(i));
    }
}

/// Log-gamma function.
#[no_mangle]
pub extern "C" fn lgamma(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::INFINITY;
    }
    if x < 0.5 {
        let ln_pi = 1.1447298858494002_f64;
        return ln_pi - libm::log(libm::fabs(libm::sin(PI * x))) - lgamma(1.0 - x);
    }
    let x = x - 1.0;
    let t = x + LANCZOS_G + 0.5;
    let mut a = LANCZOS_C[0];
    for i in 1..9 {
        a += LANCZOS_C[i] / (x + i as f64);
    }
    0.5 * libm::log(2.0 * PI) + (x + 0.5) * libm::log(t) - t + libm::log(a)
}

/// Compute lgamma for an array.
#[no_mangle]
pub unsafe extern "C" fn lgammaArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = lgamma(*a_ptr.add(i));
    }
}

fn zeta_positive(s: f64) -> f64 {
    let n = 50_i32;
    let mut sum = 0.0_f64;
    let mut sign = 1.0_f64;
    for k in 1..=n {
        sum += sign / libm::pow(k as f64, s);
        sign = -sign;
    }
    let eta = sum;
    let conversion = 1.0 - libm::pow(2.0, 1.0 - s);
    if libm::fabs(conversion) < 1e-15 {
        sum = 0.0;
        for k in 1..=(n * 2) {
            sum += 1.0 / libm::pow(k as f64, s);
        }
        return sum;
    }
    eta / conversion
}

/// Riemann zeta function.
#[no_mangle]
pub extern "C" fn zeta(s: f64) -> f64 {
    if s == 1.0 {
        return f64::INFINITY;
    }
    if s == 0.0 {
        return -0.5;
    }
    if s < 0.0 && libm::floor(s) == s && ((s as i32) & 1) == 0 {
        return 0.0;
    }
    if s > 1.0 {
        return zeta_positive(s);
    }
    let factor =
        libm::pow(2.0, s) * libm::pow(PI, s - 1.0) * libm::sin(PI * s / 2.0) * gamma(1.0 - s);
    factor * zeta_positive(1.0 - s)
}

/// Compute zeta for an array.
#[no_mangle]
pub unsafe extern "C" fn zetaArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = zeta(*a_ptr.add(i));
    }
}

/// Beta function: B(a,b) = Gamma(a)*Gamma(b)/Gamma(a+b).
#[no_mangle]
pub extern "C" fn beta(a: f64, b: f64) -> f64 {
    libm::exp(lgamma(a) + lgamma(b) - lgamma(a + b))
}

fn gammainc_series(a: f64, x: f64) -> f64 {
    let mut sum = 1.0 / a;
    let mut term = 1.0 / a;
    for n in 1..100 {
        term *= x / (a + n as f64);
        sum += term;
        if libm::fabs(term) < 1e-15 * libm::fabs(sum) {
            break;
        }
    }
    sum * libm::exp(-x + a * libm::log(x) - lgamma(a))
}

fn gammainc_cf(a: f64, x: f64) -> f64 {
    let mut b = x + 1.0 - a;
    let mut c = 1.0 / 1e-30;
    let mut d = 1.0 / b;
    let mut h = d;
    for i in 1..100 {
        let an = -(i as f64) * (i as f64 - a);
        b += 2.0;
        d = an * d + b;
        if libm::fabs(d) < 1e-30 {
            d = 1e-30;
        }
        c = b + an / c;
        if libm::fabs(c) < 1e-30 {
            c = 1e-30;
        }
        d = 1.0 / d;
        let del = d * c;
        h *= del;
        if libm::fabs(del - 1.0) < 1e-15 {
            break;
        }
    }
    libm::exp(-x + a * libm::log(x) - lgamma(a)) * h
}

/// Regularized lower incomplete gamma P(a, x).
#[no_mangle]
pub extern "C" fn gammainc(a: f64, x: f64) -> f64 {
    if x < 0.0 || a <= 0.0 {
        return f64::NAN;
    }
    if x == 0.0 {
        return 0.0;
    }
    if x < a + 1.0 {
        gammainc_series(a, x)
    } else {
        1.0 - gammainc_cf(a, x)
    }
}

/// Digamma (psi) function.
#[no_mangle]
pub extern "C" fn digamma(mut x: f64) -> f64 {
    if x < 0.0 {
        return digamma(1.0 - x) - PI / libm::tan(PI * x);
    }
    let mut result = 0.0_f64;
    while x < 6.0 {
        result -= 1.0 / x;
        x += 1.0;
    }
    let x2 = 1.0 / (x * x);
    result += libm::log(x)
        - 0.5 / x
        - x2 * (1.0 / 12.0 - x2 * (1.0 / 120.0 - x2 * (1.0 / 252.0 - x2 * (1.0 / 240.0))));
    result
}

/// Compute digamma for an array.
#[no_mangle]
pub unsafe extern "C" fn digammaArray(a_ptr: *const f64, n: i32, result_ptr: *mut f64) {
    for i in 0..n as usize {
        *result_ptr.add(i) = digamma(*a_ptr.add(i));
    }
}

// =============================================================================
// Bessel J0/J1/Y0/Y1 — ascending series (|x| <= 13) + Hankel asymptotic.
// Replaces the legacy NR rational approximations (~1e-7 J, ~1e-4 Y); coefficients
// generated in-loop. Validated to <1e-9 vs mpmath. Mirrors assembly/src/special.ts.
// =============================================================================
const SF_EULER_GAMMA: f64 = 0.5772156649015328606;
const SF_TWO_OVER_PI: f64 = 0.63661977236758134308;
const SF_ONE_OVER_PI: f64 = 0.31830988618379067154;
const BESSEL_SERIES_MAX: f64 = 13.0;

/// Hankel asymptotic for J_nu / Y_nu (nu = 0 or 1), large x.
fn bessel_hankel(nu: f64, x: f64, want_y: bool) -> f64 {
    let mu = 4.0 * nu * nu;
    let mut p = 1.0_f64;
    let mut q = 0.0_f64;
    let mut a = 1.0_f64;
    let mut xk = 1.0_f64;
    let mut prev_mag = f64::INFINITY;
    let mut k = 1_i32;
    while k <= 40 {
        let t1 = (2 * k - 1) as f64;
        a = a * (mu - t1 * t1) / (8.0 * k as f64);
        xk *= x;
        let t = a / xk;
        let mag = libm::fabs(t);
        if mag > prev_mag {
            break;
        }
        prev_mag = mag;
        let m4 = k & 3;
        let s = if m4 == 1 || m4 == 0 { 1.0 } else { -1.0 };
        if k & 1 == 1 {
            q += s * t;
        } else {
            p += s * t;
        }
        k += 1;
    }
    let chi = x - (nu * 0.5 + 0.25) * PI;
    let amp = libm::sqrt(2.0 / (PI * x));
    if want_y {
        amp * (p * libm::sin(chi) + q * libm::cos(chi))
    } else {
        amp * (p * libm::cos(chi) - q * libm::sin(chi))
    }
}

fn bessel_j0_series(x: f64) -> f64 {
    let z = -0.25 * x * x;
    let mut term = 1.0_f64;
    let mut sum = 1.0_f64;
    let mut k = 1_i32;
    while k <= 80 {
        term *= z / (k as f64 * k as f64);
        sum += term;
        if libm::fabs(term) <= libm::fabs(sum) * 1e-17 {
            break;
        }
        k += 1;
    }
    sum
}

fn bessel_j1_series(x: f64) -> f64 {
    let z = -0.25 * x * x;
    let mut term = 1.0_f64;
    let mut sum = 1.0_f64;
    let mut k = 1_i32;
    while k <= 80 {
        term *= z / (k as f64 * (k as f64 + 1.0));
        sum += term;
        if libm::fabs(term) <= libm::fabs(sum) * 1e-17 {
            break;
        }
        k += 1;
    }
    0.5 * x * sum
}

fn bessel_y0_series(x: f64) -> f64 {
    let z = 0.25 * x * x;
    let mut u = 1.0_f64;
    let mut h = 0.0_f64;
    let mut s = 0.0_f64;
    let mut sign = 1.0_f64;
    let mut k = 1_i32;
    while k <= 80 {
        u *= z / (k as f64 * k as f64);
        h += 1.0 / k as f64;
        let d = sign * h * u;
        s += d;
        sign = -sign;
        if k > 2 && libm::fabs(d) <= libm::fabs(s) * 1e-17 {
            break;
        }
        k += 1;
    }
    SF_TWO_OVER_PI * ((libm::log(0.5 * x) + SF_EULER_GAMMA) * bessel_j0_series(x) + s)
}

fn bessel_y1_series(x: f64) -> f64 {
    let z = -0.25 * x * x;
    let mut v = 0.5 * x;
    let mut hk = 0.0_f64;
    let mut hk1 = 1.0_f64;
    let mut s = (hk + hk1) * v;
    let mut k = 1_i32;
    while k <= 80 {
        v *= z / (k as f64 * (k as f64 + 1.0));
        hk += 1.0 / k as f64;
        hk1 += 1.0 / (k as f64 + 1.0);
        let d = (hk + hk1) * v;
        s += d;
        if k > 2 && libm::fabs(d) <= libm::fabs(s) * 1e-17 {
            break;
        }
        k += 1;
    }
    SF_TWO_OVER_PI * (libm::log(0.5 * x) + SF_EULER_GAMMA) * bessel_j1_series(x)
        - SF_TWO_OVER_PI / x
        - SF_ONE_OVER_PI * s
}

/// Bessel J0(x).
#[no_mangle]
pub extern "C" fn besselJ0(x: f64) -> f64 {
    let ax = libm::fabs(x);
    if ax <= BESSEL_SERIES_MAX {
        bessel_j0_series(ax)
    } else {
        bessel_hankel(0.0, ax, false)
    }
}

/// Bessel J1(x).
#[no_mangle]
pub extern "C" fn besselJ1(x: f64) -> f64 {
    let ax = libm::fabs(x);
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let val = if ax <= BESSEL_SERIES_MAX {
        bessel_j1_series(ax)
    } else {
        bessel_hankel(1.0, ax, false)
    };
    sign * val
}

/// Bessel Y0(x) (x > 0).
#[no_mangle]
pub extern "C" fn besselY0(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    if x <= BESSEL_SERIES_MAX {
        bessel_y0_series(x)
    } else {
        bessel_hankel(0.0, x, true)
    }
}

/// Bessel Y1(x) (x > 0).
#[no_mangle]
pub extern "C" fn besselY1(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    if x <= BESSEL_SERIES_MAX {
        bessel_y1_series(x)
    } else {
        bessel_hankel(1.0, x, true)
    }
}

// =============================================================================
// General Order Bessel Functions
// =============================================================================

/// Bessel J_n(x) — general integer order using forward/backward recurrence.
#[no_mangle]
pub unsafe extern "C" fn besselJ_wasm(n: i32, x: f64) -> f64 {
    let ni = if n < 0 { -n } else { n };
    let sign = if n < 0 && ni % 2 != 0 { -1.0 } else { 1.0 };

    if ni == 0 {
        return sign * besselJ0(x);
    }
    if ni == 1 {
        return sign * besselJ1(x);
    }
    if libm::fabs(x) < 1e-15 {
        return 0.0;
    }

    // Upward recurrence is stable only when x > n; otherwise use Miller backward.
    let result = if libm::fabs(x) > ni as f64 {
        // Forward recurrence: J_{k+1}(x) = (2k/x) J_k(x) - J_{k-1}(x)
        let mut j_prev = besselJ0(x);
        let mut j_curr = besselJ1(x);
        for k in 1..ni {
            let j_next = (2.0 * k as f64 / x) * j_curr - j_prev;
            j_prev = j_curr;
            j_curr = j_next;
        }
        j_curr
    } else {
        // Miller's backward recurrence
        let isqrt = libm::sqrt(40.0 * ni as f64) as i32;
        let extra = if 10 > isqrt { 10 } else { isqrt };
        let n_start = ni + 2 * extra;
        let mut j_next = 0.0_f64;
        let mut j_curr = 1.0_f64;
        let mut result_val = 0.0_f64;
        let mut sum = 0.0_f64;
        for k in (0..=n_start).rev() {
            let j_prev = (2.0 * (k + 1) as f64 / x) * j_curr - j_next;
            j_next = j_curr;
            j_curr = j_prev;
            // After the assignments j_curr = J_k and j_next = J_{k+1}; capture J_ni.
            if k == ni {
                result_val = j_curr;
            }
            if k % 2 == 0 {
                sum += j_curr;
            }
        }
        // Normalize: J_0 + 2*(J_2 + J_4 + ...) = 1
        sum = 2.0 * sum - j_curr;
        result_val / sum
    };
    sign * result
}

/// Bessel Y_n(x) — general integer order using forward recurrence.
#[no_mangle]
pub unsafe extern "C" fn besselY_wasm(n: i32, x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    let ni = if n < 0 { -n } else { n };
    let sign = if n < 0 && ni % 2 != 0 { -1.0 } else { 1.0 };

    if ni == 0 {
        return sign * besselY0(x);
    }
    if ni == 1 {
        return sign * besselY1(x);
    }

    // Forward recurrence: Y_{k+1}(x) = (2k/x) Y_k(x) - Y_{k-1}(x)
    let mut y_prev = besselY0(x);
    let mut y_curr = besselY1(x);
    for k in 1..ni {
        let y_next = (2.0 * k as f64 / x) * y_curr - y_prev;
        y_prev = y_curr;
        y_curr = y_next;
    }
    sign * y_curr
}

/// Modified Bessel I_n(x) — series expansion.
#[no_mangle]
pub unsafe extern "C" fn besselI_wasm(n: i32, x: f64) -> f64 {
    let ni = if n < 0 { -n } else { n };
    if libm::fabs(x) < 1e-15 {
        return if ni == 0 { 1.0 } else { 0.0 };
    }

    // Series: I_n(x) = sum_{m=0}^inf (x/2)^{n+2m} / (m! * Gamma(n+m+1))
    let half_x = libm::fabs(x) / 2.0;
    let mut sum = 0.0_f64;
    let mut m_fact = 1.0_f64; // m!
    for m in 0..100 {
        if m > 0 {
            m_fact *= m as f64;
        }
        let lg = lgamma(ni as f64 + m as f64 + 1.0);
        let term = libm::pow(half_x, ni as f64 + 2.0 * m as f64) / (m_fact * libm::exp(lg));
        sum += term;
        if libm::fabs(term) < libm::fabs(sum) * 1e-15 {
            break;
        }
    }
    // Sign correction: I_n(-x) = (-1)^n * I_n(x)
    if x < 0.0 && ni % 2 != 0 {
        -sum
    } else {
        sum
    }
}

/// Modified Bessel K_n(x) — K_0/K_1 + forward recurrence.
#[no_mangle]
pub unsafe extern "C" fn besselK_wasm(n: i32, x: f64) -> f64 {
    let ni = if n < 0 { -n } else { n };
    if x <= 0.0 {
        return f64::NAN;
    }

    // K_0(x)
    fn k0(x: f64) -> f64 {
        if x <= 2.0 {
            let y = x * x / 4.0;
            let i0 = unsafe { besselI_wasm(0, x) };
            -libm::log(x / 2.0) * i0
                + (-0.57721566
                    + y * (0.42278420
                        + y * (0.23069756 + y * (0.03488590 + y * (0.00262698 + y * 0.00010750)))))
        } else {
            let y = 2.0 / x;
            (libm::exp(-x) / libm::sqrt(x))
                * (1.25331414
                    + y * (-0.07832358
                        + y * (0.02189568
                            + y * (-0.01062446
                                + y * (0.00587872 + y * (-0.00251540 + y * 0.00053208))))))
        }
    }

    // K_1(x)
    fn k1(x: f64) -> f64 {
        if x <= 2.0 {
            let y = x * x / 4.0;
            let i1 = unsafe { besselI_wasm(1, x) };
            libm::log(x / 2.0) * i1
                + (1.0 / x)
                    * (1.0
                        + y * (0.15443144
                            + y * (-0.67278579
                                + y * (-0.18156897
                                    + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))))))
        } else {
            let y = 2.0 / x;
            (libm::exp(-x) / libm::sqrt(x))
                * (1.25331414
                    + y * (0.23498619
                        + y * (-0.03655620
                            + y * (0.01504268
                                + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245))))))
        }
    }

    if ni == 0 {
        return k0(x);
    }
    if ni == 1 {
        return k1(x);
    }

    // Forward recurrence: K_{k+1}(x) = (2k/x) K_k(x) + K_{k-1}(x)
    let mut k_prev = k0(x);
    let mut k_curr = k1(x);
    for k in 1..ni {
        let k_next = (2.0 * k as f64 / x) * k_curr + k_prev;
        k_prev = k_curr;
        k_curr = k_next;
    }
    k_curr
}

// =============================================================================
// Incomplete Beta Function
// =============================================================================

/// Regularized incomplete beta I_x(a, b) using continued fraction (Lentz's method).
#[no_mangle]
pub unsafe extern "C" fn betainc_wasm(a: f64, b: f64, x: f64) -> f64 {
    if x < 0.0 || x > 1.0 {
        return f64::NAN;
    }
    if x == 0.0 {
        return 0.0;
    }
    if x == 1.0 {
        return 1.0;
    }

    // Use symmetry if x > (a+1)/(a+b+2)
    if x > (a + 1.0) / (a + b + 2.0) {
        return 1.0 - betainc_wasm(b, a, 1.0 - x);
    }

    let ln_beta = lgamma(a) + lgamma(b) - lgamma(a + b);
    let front = libm::exp(libm::log(x) * a + libm::log(1.0 - x) * b - ln_beta) / a;

    let tiny = 1e-30_f64;
    let mut c = 1.0_f64;
    let mut d = 1.0 - (a + b) * x / (a + 1.0);
    if libm::fabs(d) < tiny {
        d = tiny;
    }
    d = 1.0 / d;
    let mut f = d;

    for m in 1..=200i32 {
        let mf = m as f64;
        // Even step: a_2m = m(b-m)x / ((a+2m-1)(a+2m))
        let num = mf * (b - mf) * x / ((a + 2.0 * mf - 1.0) * (a + 2.0 * mf));
        d = 1.0 + num * d;
        if libm::fabs(d) < tiny {
            d = tiny;
        }
        c = 1.0 + num / c;
        if libm::fabs(c) < tiny {
            c = tiny;
        }
        d = 1.0 / d;
        f *= d * c;

        // Odd step: a_{2m+1} = -(a+m)(a+b+m)x / ((a+2m)(a+2m+1))
        let num2 = -(a + mf) * (a + b + mf) * x / ((a + 2.0 * mf) * (a + 2.0 * mf + 1.0));
        d = 1.0 + num2 * d;
        if libm::fabs(d) < tiny {
            d = tiny;
        }
        c = 1.0 + num2 / c;
        if libm::fabs(c) < tiny {
            c = tiny;
        }
        d = 1.0 / d;
        let delta = d * c;
        f *= delta;

        if libm::fabs(delta - 1.0) < 1e-14 {
            break;
        }
    }

    front * f
}

// =============================================================================
// Elliptic Integrals
// =============================================================================

/// Complete elliptic integral of the first kind K(m) via AGM.
#[no_mangle]
pub unsafe extern "C" fn ellipticK_wasm(m: f64) -> f64 {
    if m < 0.0 || m >= 1.0 {
        return f64::NAN;
    }
    if m == 0.0 {
        return PI / 2.0;
    }

    let mut a = 1.0_f64;
    let mut b = libm::sqrt(1.0 - m);
    for _ in 0..50 {
        let a_new = (a + b) / 2.0;
        let b_new = libm::sqrt(a * b);
        if libm::fabs(a_new - b_new) < 1e-15 {
            a = a_new;
            break;
        }
        a = a_new;
        b = b_new;
    }
    PI / (2.0 * a)
}

/// Incomplete elliptic integral of the second kind E(phi, m) via Simpson's rule.
#[no_mangle]
pub unsafe extern "C" fn ellipticE_wasm(phi: f64, m: f64) -> f64 {
    let n = 100_i32;
    let h = phi / n as f64;

    let sin_sq = |v: f64| -> f64 {
        let s = libm::sin(v);
        s * s
    };

    let mut sum = libm::sqrt(1.0 - m * sin_sq(0.0)) + libm::sqrt(1.0 - m * sin_sq(phi));
    for i in 1..n {
        let t = i as f64 * h;
        let weight = if i % 2 == 0 { 2.0 } else { 4.0 };
        sum += weight * libm::sqrt(1.0 - m * sin_sq(t));
    }
    (h / 3.0) * sum
}

// =============================================================================
// Complete Elliptic Integrals via AGM (Slice 5.3)
//
// K(m) = π / (2 · agm(1, √(1−m)))
//
// E(m) via the Carlson-Bulirsch AGM variant:
//   a₀ = 1, b₀ = √(1−m), c₀ = √m
//   a_{n+1} = (aₙ + bₙ) / 2
//   b_{n+1} = √(aₙ · bₙ)
//   c_{n+1} = (aₙ − bₙ) / 2
//   K = π / (2 · a_∞)
//   E = K · (1 − ½ · Σ_{k=0}^{∞} 2^k · c_k²)
//
// Domain: m ∈ [0, 1).  Special cases: K(1) = +∞, E(1) = 1.0.
// Out-of-domain (m < 0 or m > 1) → NaN.
//
// Both converge quadratically; ≤ 10 iterations suffice for f64 precision.
// =============================================================================

/// Complete elliptic integral of the first kind K(m) via AGM (Slice 5.3).
///
/// Domain: m ∈ [0, 1).  K(1) = +∞.  m < 0 or m > 1 → NaN.
pub fn elliptic_k(m: f64) -> f64 {
    if m != m {
        return f64::NAN; // propagate NaN
    }
    if m < 0.0 || m > 1.0 {
        return f64::NAN;
    }
    if m == 1.0 {
        return f64::INFINITY;
    }
    if m == 0.0 {
        return PI / 2.0;
    }

    let mut a = 1.0_f64;
    let mut b = libm::sqrt(1.0 - m);
    for _ in 0..50 {
        let a_new = (a + b) / 2.0;
        let b_new = libm::sqrt(a * b);
        if libm::fabs(a_new - b_new) < 1e-16 * a_new {
            a = a_new;
            break;
        }
        a = a_new;
        b = b_new;
    }
    PI / (2.0 * a)
}

/// Complete elliptic integral of the second kind E(m) via AGM (Slice 5.3).
///
/// Domain: m ∈ [0, 1].  E(0) = E(1) = 1 (E(0) = π/2, E(1) = 1).
/// m < 0 or m > 1 → NaN.
pub fn elliptic_e(m: f64) -> f64 {
    if m != m {
        return f64::NAN;
    }
    if m < 0.0 || m > 1.0 {
        return f64::NAN;
    }
    if m == 0.0 {
        return PI / 2.0;
    }
    if m == 1.0 {
        return 1.0;
    }

    let mut a = 1.0_f64;
    let mut b = libm::sqrt(1.0 - m);

    // Accumulate: sum = Σ 2^k · c_k²
    // k=0 contributes c_0² = m (weight 2^0 = 1, c_0 = √m)
    let mut sum = m; // 2^0 · c_0² = m
    let mut pow2: f64 = 1.0; // 2^k

    for _ in 0..50 {
        let a_new = (a + b) / 2.0;
        let b_new = libm::sqrt(a * b);
        let c_new = (a - b) / 2.0;
        pow2 *= 2.0;
        sum += pow2 * c_new * c_new;
        if libm::fabs(c_new) < 1e-16 * a_new {
            a = a_new;
            break;
        }
        a = a_new;
        b = b_new;
    }
    let k = PI / (2.0 * a);
    k * (1.0 - 0.5 * sum)
}

// =============================================================================
// Lambert W Function
// =============================================================================

/// Lambert W principal branch via Halley's method.
#[no_mangle]
pub unsafe extern "C" fn lambertW_wasm(x: f64) -> f64 {
    let neg_inv_e = -1.0 / core::f64::consts::E;
    if x < neg_inv_e {
        return f64::NAN;
    }
    if x == 0.0 {
        return 0.0;
    }
    if libm::fabs(x - core::f64::consts::E) < 1e-15 {
        return 1.0;
    }

    // Initial guess
    let mut w = if x < 1.0 {
        x
    } else if x < core::f64::consts::E {
        libm::log(x)
    } else {
        libm::log(x) - libm::log(libm::log(x))
    };

    // Halley's iteration
    for _ in 0..100 {
        let ew = libm::exp(w);
        let wew = w * ew;
        let f = wew - x;
        let fp = ew * (w + 1.0);
        let fpp = ew * (w + 2.0);
        let dw = f / (fp - f * fpp / (2.0 * fp));
        w -= dw;
        if libm::fabs(dw) < 1e-15 {
            break;
        }
    }
    w
}

// =============================================================================
// Fresnel Integrals
// =============================================================================

/// Fresnel cosine integral C(x) = integral_0^x cos(pi*t^2/2) dt.
#[no_mangle]
pub unsafe extern "C" fn fresnelC_wasm(x: f64) -> f64 {
    let ax = libm::fabs(x);
    let sign = if x < 0.0 { -1.0 } else { 1.0 };

    // Series: C(x) = sum_{n=0}^inf (-1)^n (pi/2)^{2n} x^{4n+1} / ((4n+1)(2n)!)
    let pi_half = PI / 2.0;
    let x4 = ax * ax * ax * ax;
    let mut term = ax; // n=0 term
    let mut sum = ax;

    for n in 1..50 {
        let nf = n as f64;
        term *= -pi_half * pi_half * x4 / ((2.0 * nf) * (2.0 * nf - 1.0)) * (4.0 * nf - 3.0)
            / (4.0 * nf + 1.0);
        sum += term;
        if libm::fabs(term) < libm::fabs(sum) * 1e-15 {
            break;
        }
    }
    sign * sum
}

/// Fresnel sine integral S(x) = integral_0^x sin(pi*t^2/2) dt.
#[no_mangle]
pub unsafe extern "C" fn fresnelS_wasm(x: f64) -> f64 {
    let ax = libm::fabs(x);
    let sign = if x < 0.0 { -1.0 } else { 1.0 };

    // Series: S(x) = sum_{n=0}^inf (-1)^n (pi/2)^{2n+1} x^{4n+3} / ((4n+3)(2n+1)!)
    let pi_half = PI / 2.0;
    let x4 = ax * ax * ax * ax;
    // n=0 term: (pi/2) * x^3 / 3
    let mut term = pi_half * ax * ax * ax / 3.0;
    let mut sum = term;

    for n in 1..50 {
        let nf = n as f64;
        term *= -pi_half * pi_half * x4 / ((2.0 * nf + 1.0) * (2.0 * nf)) * (4.0 * nf - 1.0)
            / (4.0 * nf + 3.0);
        sum += term;
        if libm::fabs(term) < libm::fabs(sum) * 1e-15 {
            break;
        }
    }
    sign * sum
}

// =============================================================================
// Airy Functions Ai(x) and Bi(x)
// =============================================================================
//
// Algorithm: split into three ranges.
//
// Small |x| (|x| ≤ 4.5) — power series from DLMF §9.2.2:
//   f(x) = Σ  x^{3k}/(3k)! * prod_{j=1}^{k}(3j-2)   (even terms of Ai/Bi series)
//   g(x) = Σ  x^{3k+1}/(3k+1)! * prod_{j=1}^{k}(3j-1) (odd terms)
//   Ai(x) = c1·f(x) − c2·g(x)
//   Bi(x) = √3·(c1·f(x) + c2·g(x))
//   c1 = Ai(0) = 1/(3^{2/3}·Γ(2/3)) ≈ 0.35502805388781723926
//   c2 = −Ai'(0) = 1/(3^{1/3}·Γ(1/3)) ≈ 0.25881940379280679841
//
// Large positive x (x > 4.5) — asymptotic expansion (DLMF §9.7.3):
//   ζ = (2/3)·x^{3/2}
//   Ai(x) ~ exp(-ζ)/(2√π·x^{1/4}) · Σ (-1)^k·c_k/ζ^k
//   Bi(x) ~ exp(+ζ)/(√π·x^{1/4})  · Σ       c_k/ζ^k
//   c_0 = 1, c_1 = 5/72, c_2 = 385/10368, c_3 = 85085/2239488, ...
//   c_k = prod_{s=1}^{k} (6s-5)(6s-3)(6s-1) / (216·s·k!) (simplified)
//
// Large negative x (x < -4.5) — oscillatory asymptotic (DLMF §9.7.7):
//   θ = ζ − π/4,  ζ = (2/3)·|x|^{3/2}
//   Ai(x) ~ (sin θ·P + cos θ·Q)/(√π·|x|^{1/4})
//   Bi(x) ~ (cos θ·P − sin θ·Q)/(√π·|x|^{1/4})  ← with sign change for Bi
//   P = Σ (-1)^k·d_{2k}/ζ^{2k},  Q = Σ (-1)^k·d_{2k+1}/ζ^{2k+1}
//   d_k = c_k (same coefficients as above)

// Ai(0) = 1/(3^{2/3}·Γ(2/3))
const AI0: f64 = 0.35502805388781723926;
// −Ai'(0) = 1/(3^{1/3}·Γ(1/3))
const AI_PRIME0: f64 = 0.25881940379280679841;
// |x| threshold for switching from the series to the asymptotic.
const AIRY_XBIG: f64 = 5.0;

/// Next asymptotic coefficient u_k from u_{k-1} (DLMF 9.7.2):
///   u_k = u_{k-1} (6k-5)(6k-3)(6k-1) / ((2k-1) · 216 · k).
/// (The legacy hardcoded c_5/c_6 were wrong; generation removes that error.)
#[inline]
fn airy_u_next(u_prev: f64, k: i32) -> f64 {
    let kf = k as f64;
    u_prev * (6.0 * kf - 5.0) * (6.0 * kf - 3.0) * (6.0 * kf - 1.0) / ((2.0 * kf - 1.0) * 216.0 * kf)
}

/// Large positive x: Ai ~ e^{-ζ}/(2√π x^{1/4}) Σ (-1)^k u_k/ζ^k;
///                   Bi ~ e^{ζ}/(√π x^{1/4}) Σ u_k/ζ^k.
fn airy_asym_pos(x: f64, is_ai: bool) -> f64 {
    let xp = libm::pow(x, 0.25);
    let zeta = (2.0 / 3.0) * x * libm::sqrt(x);
    let mut u = 1.0_f64;
    let mut zk = 1.0_f64;
    let mut sum = 1.0_f64;
    let mut prev_mag = f64::INFINITY;
    let mut k = 1_i32;
    while k <= 40 {
        u = airy_u_next(u, k);
        zk *= zeta;
        let t = u / zk;
        if libm::fabs(t) > prev_mag {
            break;
        }
        prev_mag = libm::fabs(t);
        sum += if is_ai && (k & 1) == 1 { -t } else { t };
        k += 1;
    }
    let sp = libm::sqrt(PI);
    if is_ai {
        libm::exp(-zeta) * sum / (2.0 * sp * xp)
    } else {
        libm::exp(zeta) * sum / (sp * xp)
    }
}

/// Large negative x (oscillatory), θ = ζ − π/4:
///   P = Σ (-1)^j u_{2j}/ζ^{2j}, Q = Σ (-1)^j u_{2j+1}/ζ^{2j+1};
///   Ai(-|x|) = (cosθ P + sinθ Q)/(√π |x|^{1/4})   (DLMF 9.7.9)
///   Bi(-|x|) = (−sinθ P + cosθ Q)/(√π |x|^{1/4})  (DLMF 9.7.10)
fn airy_asym_neg(x: f64, is_ai: bool) -> f64 {
    let ax = libm::fabs(x);
    let axp = libm::pow(ax, 0.25);
    let zeta = (2.0 / 3.0) * ax * libm::sqrt(ax);
    let mut u = 1.0_f64;
    let mut zk = 1.0_f64;
    let mut pp = 1.0_f64;
    let mut qq = 0.0_f64;
    let mut prev_mag = f64::INFINITY;
    let mut k = 1_i32;
    while k <= 40 {
        u = airy_u_next(u, k);
        zk *= zeta;
        let t = u / zk;
        if libm::fabs(t) > prev_mag {
            break;
        }
        prev_mag = libm::fabs(t);
        let m4 = k & 3;
        let s = if m4 == 1 || m4 == 0 { 1.0 } else { -1.0 };
        if k & 1 == 1 {
            qq += s * t;
        } else {
            pp += s * t;
        }
        k += 1;
    }
    let theta = zeta - PI / 4.0;
    let sp = libm::sqrt(PI);
    if is_ai {
        (libm::cos(theta) * pp + libm::sin(theta) * qq) / (sp * axp)
    } else {
        (-libm::sin(theta) * pp + libm::cos(theta) * qq) / (sp * axp)
    }
}

/// Airy function Ai(x).
pub fn airy_ai(x: f64) -> f64 {
    if x > AIRY_XBIG {
        airy_asym_pos(x, true)
    } else if x < -AIRY_XBIG {
        airy_asym_neg(x, true)
    } else {
        // Small |x| — power series (DLMF §9.2.2)
        let x3 = x * x * x;
        let mut f = 1.0_f64;  // Ai(0)/AI0 even part
        let mut g = x;        // Ai'(0)/(-AI_PRIME0) odd part
        let mut f_term = 1.0_f64;
        let mut g_term = x;
        let mut factorial_f = 1.0_f64; // accumulates (3k)!
        let mut factorial_g = 1.0_f64; // accumulates (3k+1)!
        // Series: f(x) = Σ_{k≥1} x^{3k} * Π_{j=1}^k (3j-2) / (3k)!
        //        g(x) = Σ_{k≥1} x^{3k+1} * Π_{j=1}^k (3j-1) / (3k+1)!
        let mut prod_f = 1.0_f64; // Π (3j-2)
        let mut prod_g = 1.0_f64; // Π (3j-1)
        for k in 1_i32..=30 {
            let kf = k as f64;
            // update factorials: (3k)! = (3k-2)!·(3k-1)·(3k-0) ... step by 3
            factorial_f *= (3.0 * kf - 2.0) * (3.0 * kf - 1.0) * (3.0 * kf);
            factorial_g *= (3.0 * kf - 1.0) * (3.0 * kf) * (3.0 * kf + 1.0);
            prod_f *= 3.0 * kf - 2.0;
            prod_g *= 3.0 * kf - 1.0;
            f_term *= x3;
            g_term *= x3;
            let df = f_term * prod_f / factorial_f;
            let dg = g_term * prod_g / factorial_g;
            f += df;
            g += dg;
            if libm::fabs(df) < libm::fabs(f) * 1e-16
                && libm::fabs(dg) < libm::fabs(g) * 1e-16
            {
                break;
            }
        }
        AI0 * f - AI_PRIME0 * g
    }
}

/// Airy function Bi(x).
pub fn airy_bi(x: f64) -> f64 {
    let sqrt3 = libm::sqrt(3.0_f64);

    if x > AIRY_XBIG {
        airy_asym_pos(x, false)
    } else if x < -AIRY_XBIG {
        airy_asym_neg(x, false)
    } else {
        // Small |x| — power series, same as Ai but scaled by sqrt(3)
        let x3 = x * x * x;
        let mut f = 1.0_f64;
        let mut g = x;
        let mut f_term = 1.0_f64;
        let mut g_term = x;
        let mut factorial_f = 1.0_f64;
        let mut factorial_g = 1.0_f64;
        let mut prod_f = 1.0_f64;
        let mut prod_g = 1.0_f64;
        for k in 1_i32..=30 {
            let kf = k as f64;
            factorial_f *= (3.0 * kf - 2.0) * (3.0 * kf - 1.0) * (3.0 * kf);
            factorial_g *= (3.0 * kf - 1.0) * (3.0 * kf) * (3.0 * kf + 1.0);
            prod_f *= 3.0 * kf - 2.0;
            prod_g *= 3.0 * kf - 1.0;
            f_term *= x3;
            g_term *= x3;
            let df = f_term * prod_f / factorial_f;
            let dg = g_term * prod_g / factorial_g;
            f += df;
            g += dg;
            if libm::fabs(df) < libm::fabs(f) * 1e-16
                && libm::fabs(dg) < libm::fabs(g) * 1e-16
            {
                break;
            }
        }
        // Bi(x) = sqrt(3) * (AI0 * f + AI_PRIME0 * g)
        sqrt3 * (AI0 * f + AI_PRIME0 * g)
    }
}

// =============================================================================
// Carlson Symmetric Forms (Slice 6.4)
//
// Reference: Carlson (1995) "Numerical Computation of Real or Complex
//   Elliptic Integrals," Numer. Algorithms 10:13-26.
//   Numerical Recipes (Press et al.) §6.11 — duplication algorithm.
//
// All four R-forms converge quadratically via the duplication theorem.
// Tolerance r * 0.0015 per NR; ≤ 30 iterations suffice for f64.
//
// Domain restrictions:
//   RF: x, y, z ≥ 0, at most one zero.
//   RC: x ≥ 0, y ≠ 0.
//   RD: x, y ≥ 0, z > 0, at most one of x, y is zero.
//   RJ: x, y, z ≥ 0, p ≠ 0, at most one of x, y, z is zero.
// =============================================================================

/// Carlson degenerate symmetric integral RC(x, y).
///
/// RC(x, y) = RF(x, y, y) — pure duplication without an external sum.
/// Identity: RC(0, 1) = π/2; RC(1, 1) = 1; RC(x, x) = 1/√x.
///
/// Domain: x ≥ 0, y > 0.
pub fn carlson_rc(x: f64, y: f64) -> f64 {
    if x < 0.0 || y <= 0.0 {
        return f64::NAN;
    }
    let mut xx = x;
    let mut yy = y;
    for _ in 0..50 {
        let lam = 2.0 * libm::sqrt(xx * yy) + yy;
        xx = (xx + lam) / 4.0;
        yy = (yy + lam) / 4.0;
        let ave = (xx + 2.0 * yy) / 3.0; // (x + y + y) / 3
        let dx = (ave - xx) / ave;
        let dy = (ave - yy) / ave;
        if libm::fabs(dx) < 1e-10 && libm::fabs(dy) < 1e-10 {
            let s = dx * dx * (3.0 + dx * (1.0 + dx * (0.75 + dx * 9.0 / 22.0)));
            return (1.0 + s) / libm::sqrt(ave);
        }
    }
    1.0 / libm::sqrt(yy)
}

/// Carlson symmetric integral RF(x, y, z).
///
/// RF = (1/2) ∫_0^∞ dt / (√(t+x)·√(t+y)·√(t+z))
///
/// Identities used for testing (DLMF §19.20):
///   RF(0, 1, 2) = Γ(1/4) Γ(3/4) / (2√(2π)) ≈ 1.3110287771461...
///   RF(0, y, y) = π / (2√y)
///   RF(x, x, x) = 1/√x
///
/// Domain: x, y, z ≥ 0, at most one zero.
pub fn carlson_rf(x: f64, y: f64, z: f64) -> f64 {
    if x < 0.0 || y < 0.0 || z < 0.0 {
        return f64::NAN;
    }
    // At most one zero allowed.
    let n_zeros = (x == 0.0) as u32 + (y == 0.0) as u32 + (z == 0.0) as u32;
    if n_zeros > 1 {
        return f64::NAN;
    }
    let mut xx = x;
    let mut yy = y;
    let mut zz = z;
    for _ in 0..50 {
        let sx = libm::sqrt(xx);
        let sy = libm::sqrt(yy);
        let sz = libm::sqrt(zz);
        let lam = sx * sy + sy * sz + sz * sx;
        xx = (xx + lam) / 4.0;
        yy = (yy + lam) / 4.0;
        zz = (zz + lam) / 4.0;
        let ave = (xx + yy + zz) / 3.0;
        let dx = (ave - xx) / ave;
        let dy = (ave - yy) / ave;
        let dz = (ave - zz) / ave;
        if libm::fabs(dx) < 1e-10 && libm::fabs(dy) < 1e-10 && libm::fabs(dz) < 1e-10 {
            let e2 = dx * dy - dz * dz;
            let e3 = dx * dy * dz;
            return (1.0
                + e2 * (-1.0 / 10.0 + 3.0 * e2 / 44.0 - 9.0 * e3 / 52.0)
                + e3 / 14.0)
                / libm::sqrt(ave);
        }
    }
    1.0 / libm::sqrt(zz)
}

/// Carlson symmetric integral RD(x, y, z).
///
/// RD(x, y, z) = (3/2) ∫_0^∞ dt / (√(t+x)·√(t+y)·(t+z)^{3/2})
///
/// Useful identity (DLMF §19.20.3):
///   RD(0, 2, 1) = 3(Γ(3/4))² / (2^{1/4} √π) ≈ 1.7972103521033...
///   RF(x,y,z) + RD(x,y,z) combination gives Pi (complete third kind).
///
/// Domain: x, y ≥ 0, z > 0, at most one of x, y is zero.
pub fn carlson_rd(x: f64, y: f64, z: f64) -> f64 {
    if x < 0.0 || y < 0.0 || z <= 0.0 {
        return f64::NAN;
    }
    if x == 0.0 && y == 0.0 {
        return f64::NAN;
    }
    // Degenerate case: x=y=z — algorithm converges prematurely; return exact value.
    if x == y && y == z {
        return libm::pow(x, -1.5);
    }
    let mut xx = x;
    let mut yy = y;
    let mut zz = z;
    let mut sum = 0.0_f64;
    let mut fac = 1.0_f64;
    for _ in 0..50 {
        let sx = libm::sqrt(xx);
        let sy = libm::sqrt(yy);
        let sz = libm::sqrt(zz);
        let lam = sx * sy + sy * sz + sz * sx;
        sum += fac / (sz * (zz + lam));
        fac /= 4.0;
        xx = (xx + lam) / 4.0;
        yy = (yy + lam) / 4.0;
        zz = (zz + lam) / 4.0;
        let ave = (xx + yy + 3.0 * zz) / 5.0;
        let dx = (ave - xx) / ave;
        let dy = (ave - yy) / ave;
        let dz = (ave - zz) / ave;
        if libm::fabs(dx) < 1e-10 && libm::fabs(dy) < 1e-10 && libm::fabs(dz) < 1e-10 {
            let xy = dx * dy;
            let xz = dx * dz;
            let yz = dy * dz;
            let z2 = dz * dz;
            let e2 = xy - xz - yz - z2;
            let e3 = xy * dz + dz * (xz + yz);
            let e4 = xy * z2;
            let e5 = dz * z2 * dz;
            return 3.0 * sum
                + fac
                    * (1.0
                        + e2 * (-3.0 / 14.0)
                        + e3 * (1.0 / 6.0)
                        + e2 * e2 * (9.0 / 88.0)
                        + e4 * (-45.0 / 132.0)
                        - e5 * (5.0 / 44.0)
                        + e3 * e2 * (-3.0 / 44.0))
                    / (ave * ave * libm::sqrt(ave));
        }
    }
    3.0 * sum + fac / (zz * zz * libm::sqrt(zz))
}

/// Carlson symmetric integral RJ(x, y, z, p).
///
/// RJ(x, y, z, p) = (3/2) ∫_0^∞ dt / ((t+p)·√(t+x)·√(t+y)·√(t+z))
///
/// Domain: x, y, z ≥ 0, p ≠ 0, at most one of x, y, z is zero.
pub fn carlson_rj(x: f64, y: f64, z: f64, p: f64) -> f64 {
    if x < 0.0 || y < 0.0 || z < 0.0 || p == 0.0 {
        return f64::NAN;
    }
    let n_zeros = (x == 0.0) as u32 + (y == 0.0) as u32 + (z == 0.0) as u32;
    if n_zeros > 1 {
        return f64::NAN;
    }
    let mut xx = x;
    let mut yy = y;
    let mut zz = z;
    let mut pp = p;
    let mut sum = 0.0_f64;
    let mut fac = 1.0_f64;
    for _ in 0..50 {
        let sx = libm::sqrt(xx);
        let sy = libm::sqrt(yy);
        let sz = libm::sqrt(zz);
        let lam = sx * sy + sy * sz + sz * sx;
        let alpha = pp * (sx + sy + sz) + sx * sy * sz;
        let alpha2 = alpha * alpha;
        let beta = pp * (pp + lam) * (pp + lam);
        sum += fac * carlson_rc(alpha2, beta);
        fac /= 4.0;
        xx = (xx + lam) / 4.0;
        yy = (yy + lam) / 4.0;
        zz = (zz + lam) / 4.0;
        pp = (pp + lam) / 4.0;
        let ave = (xx + yy + zz + pp + pp) / 5.0;
        let dx = (ave - xx) / ave;
        let dy = (ave - yy) / ave;
        let dz = (ave - zz) / ave;
        let dp = (ave - pp) / ave;
        if libm::fabs(dx) < 1e-10
            && libm::fabs(dy) < 1e-10
            && libm::fabs(dz) < 1e-10
            && libm::fabs(dp) < 1e-10
        {
            let xyz = dx * dy + dy * dz + dz * dx;
            let p2 = dp * dp;
            let e2 = xyz - 3.0 * p2;
            let e3 = dx * dy * dz + 2.0 * xyz * dp - 3.0 * p2 * dp;
            let e4 = (2.0 * dx * dy * dz + xyz * dp + 3.0 * p2 * dp) * dp;
            let e5 = dx * dy * dz * p2;
            return 3.0 * sum
                + fac
                    * (1.0
                        + e2 * (-3.0 / 14.0)
                        + e3 / 6.0
                        + e2 * e2 * 9.0 / 88.0
                        - e4 * 45.0 / 132.0
                        + e5 * (-5.0 / 44.0)
                        + e3 * e2 * (-3.0 / 44.0))
                    / (ave * ave * libm::sqrt(ave));
        }
    }
    // Fallback
    3.0 * sum + fac / (pp * pp * libm::sqrt(pp))
}

// =============================================================================
// Incomplete Elliptic Integrals via Carlson Forms (Slice 6.4)
//
// Legendre–Carlson identities (DLMF §19.25):
//   F(φ, m) = sin(φ) · RF(cos²φ, 1 − m·sin²φ, 1)
//   E(φ, m) = sin(φ) · RF(c², 1−m·s², 1) − (m/3)·sin³φ · RD(c², 1−m·s², 1)
//             where c = cos(φ), s = sin(φ)
//   Π(n, φ, m) = sin(φ) · RF(c², 1−m·s², 1)
//              + (n/3) · sin³φ · RJ(c², 1−m·s², 1, 1−n·s²)
//
// These reduce to the complete forms when φ = π/2 (cos φ = 0, sin φ = 1).
// =============================================================================

/// Incomplete elliptic integral of the first kind F(φ, m).
///
/// F(φ, m) = ∫_0^φ dθ / √(1 − m·sin²θ)
///
/// Special cases:
///   F(0, m) = 0
///   F(π/2, m) = K(m)  (complete first kind)
///
/// Domain: 0 ≤ φ ≤ π/2, 0 ≤ m < 1 (or m·sin²φ < 1).
pub fn elliptic_f_incomplete(phi: f64, m: f64) -> f64 {
    if phi == 0.0 {
        return 0.0;
    }
    let s = libm::sin(phi);
    let c = libm::cos(phi);
    let s2 = s * s;
    let x = c * c;
    let y = 1.0 - m * s2;
    if y < 0.0 {
        return f64::NAN;
    }
    s * carlson_rf(x, y, 1.0)
}

/// Incomplete elliptic integral of the second kind E(φ, m).
///
/// E(φ, m) = ∫_0^φ √(1 − m·sin²θ) dθ
///
/// Special cases:
///   E(0, m) = 0
///   E(π/2, m) = E(m)  (complete second kind)
///
/// Domain: 0 ≤ φ ≤ π/2, 0 ≤ m ≤ 1.
pub fn elliptic_e_incomplete(phi: f64, m: f64) -> f64 {
    if phi == 0.0 {
        return 0.0;
    }
    let s = libm::sin(phi);
    let c = libm::cos(phi);
    let s2 = s * s;
    let c2 = c * c;
    let y = 1.0 - m * s2;
    if y < 0.0 {
        return f64::NAN;
    }
    s * carlson_rf(c2, y, 1.0) - (m / 3.0) * s * s2 * carlson_rd(c2, y, 1.0)
}

/// Incomplete elliptic integral of the third kind Π(n, φ, m).
///
/// Π(n, φ, m) = ∫_0^φ dθ / ((1 − n·sin²θ) √(1 − m·sin²θ))
///
/// Special cases:
///   Π(n, 0, m) = 0
///   Π(n, π/2, m) = Π(n, m)  (complete third kind)
///
/// Domain: 0 ≤ φ ≤ π/2, 0 ≤ m < 1, 1 − n·sin²φ > 0.
pub fn elliptic_pi_incomplete(n: f64, phi: f64, m: f64) -> f64 {
    if phi == 0.0 {
        return 0.0;
    }
    let s = libm::sin(phi);
    let c = libm::cos(phi);
    let s2 = s * s;
    let c2 = c * c;
    let y = 1.0 - m * s2;
    let q = 1.0 - n * s2;
    if y < 0.0 || q <= 0.0 {
        return f64::NAN;
    }
    s * carlson_rf(c2, y, 1.0) + (n / 3.0) * s * s2 * carlson_rj(c2, y, 1.0, q)
}
