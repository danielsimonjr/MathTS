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

/// Complementary error function erfc(x) computed directly to avoid catastrophic cancellation.
/// Uses Abramowitz & Stegun approximation for 1 - erf(x).
#[no_mangle]
pub extern "C" fn erfc(x: f64) -> f64 {
    let ax = libm::fabs(x);
    let t = 1.0 / (1.0 + 0.3275911 * ax);
    let poly = t
        * (0.254829592
            + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    let result = poly * libm::exp(-ax * ax);
    if x < 0.0 {
        2.0 - result
    } else {
        result
    }
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

/// Bessel J0(x).
#[no_mangle]
pub extern "C" fn besselJ0(x: f64) -> f64 {
    let x = libm::fabs(x);
    if x < 8.0 {
        let y = x * x;
        let ans1 = 57568490574.0
            + y * (-13362590354.0
                + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
        let ans2 = 57568490411.0
            + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
        ans1 / ans2
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 0.785398164;
        let ans1 = 1.0
            + y * (-0.001098628627
                + y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
        let ans2 = -0.01562499995
            + y * (0.0001430488765
                + y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
        libm::sqrt(0.636619772 / x) * (libm::cos(xx) * ans1 - z * libm::sin(xx) * ans2)
    }
}

/// Bessel J1(x).
#[no_mangle]
pub extern "C" fn besselJ1(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = libm::fabs(x);
    if x < 8.0 {
        let y = x * x;
        let ans1 = x
            * (72362614232.0
                + y * (-7895059235.0
                    + y * (242396853.1
                        + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
        let ans2 = 144725228442.0
            + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
        (sign * ans1) / ans2
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 2.356194491;
        let ans1 = 1.0
            + y * (0.00183105
                + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
        let ans2 = 0.04687499995
            + y * (-0.0002002690873
                + y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
        sign * libm::sqrt(0.636619772 / x) * (libm::cos(xx) * ans1 - z * libm::sin(xx) * ans2)
    }
}

/// Bessel Y0(x) (x > 0).
#[no_mangle]
pub extern "C" fn besselY0(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    if x < 8.0 {
        let y = x * x;
        let ans1 = -2957821389.0
            + y * (7062834065.0
                + y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
        let ans2 = 40076544269.0
            + y * (745249964.8 + y * (7189466.438 + y * (47447.2647 + y * (226.1030244 + y))));
        ans1 / ans2 + 0.636619772 * besselJ0(x) * libm::log(x)
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 0.785398164;
        let ans1 = 1.0
            + y * (-0.001098628627
                + y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
        let ans2 = -0.01562499995
            + y * (0.0001430488765
                + y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
        libm::sqrt(0.636619772 / x) * (libm::sin(xx) * ans1 + z * libm::cos(xx) * ans2)
    }
}

/// Bessel Y1(x) (x > 0).
#[no_mangle]
pub extern "C" fn besselY1(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    if x < 8.0 {
        let y = x * x;
        let ans1 = x
            * (-4900604943000.0
                + y * (1275274390000.0
                    + y * (-51534381390.0
                        + y * (734926455.1 + y * (-4237922.726 + y * 8511.937935)))));
        let ans2 = 24909857380000.0
            + y * (424441966400.0
                + y * (3733650367.0
                    + y * (22459040.02 + y * (102042.605 + y * (354.9632885 + y)))));
        ans1 / ans2 + 0.636619772 * (besselJ1(x) * libm::log(x) - 1.0 / x)
    } else {
        let z = 8.0 / x;
        let y = z * z;
        let xx = x - 2.356194491;
        let ans1 = 1.0
            + y * (0.00183105
                + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
        let ans2 = 0.04687499995
            + y * (-0.0002002690873
                + y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
        libm::sqrt(0.636619772 / x) * (libm::sin(xx) * ans1 + z * libm::cos(xx) * ans2)
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

    let result = if ni <= 20 || libm::fabs(x) > ni as f64 {
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
            if k == ni {
                result_val = j_next;
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

/// Precomputed asymptotic coefficients c_k for k = 0..6.
/// c_k = Γ(3k + 1/2) / (54^k · k! · Γ(k + 1/2))   (DLMF 9.7.1 notation).
const AIRY_C: [f64; 7] = [
    1.0,
    5.0 / 72.0,
    385.0 / 10368.0,
    85085.0 / 2239488.0,
    37182145.0 / 644972544.0,
    5765760010.25 / 61917364224.0, // ≈ 0.09309
    1519768071625.0 / 8918845788160.0, // ≈ 0.17036 — truncation acceptable
];

// Ai(0) = 1/(3^{2/3}·Γ(2/3))
const AI0: f64 = 0.35502805388781723926;
// −Ai'(0) = 1/(3^{1/3}·Γ(1/3))
const AI_PRIME0: f64 = 0.25881940379280679841;

/// Airy function Ai(x).
pub fn airy_ai(x: f64) -> f64 {
    const XBIG: f64 = 4.5;

    if x > XBIG {
        // Large positive — decaying exponential asymptotic
        let xp = libm::pow(x, 0.25);       // x^{1/4}
        let x32 = x * libm::sqrt(x);      // x^{3/2}
        let zeta = (2.0 / 3.0) * x32;
        // Asymptotic series P = Σ (-1)^k c_k / ζ^k
        let mut p = 0.0_f64;
        let mut zk = 1.0_f64; // ζ^k
        let mut sign = 1.0_f64;
        for k in 0..AIRY_C.len() {
            p += sign * AIRY_C[k] / zk;
            zk *= zeta;
            sign = -sign;
        }
        libm::exp(-zeta) * p / (2.0 * libm::sqrt(PI) * xp)
    } else if x < -XBIG {
        // Large negative — oscillatory asymptotic
        let ax = libm::fabs(x);
        let axp = libm::pow(ax, 0.25);
        let ax32 = ax * libm::sqrt(ax);
        let zeta = (2.0 / 3.0) * ax32;
        let theta = zeta - PI / 4.0;
        // P even sum, Q odd sum
        let mut p = 0.0_f64;
        let mut q = 0.0_f64;
        let mut zk = 1.0_f64;
        let mut sign = 1.0_f64;
        for k in 0..AIRY_C.len() {
            if k % 2 == 0 {
                p += sign * AIRY_C[k] / zk;
            } else {
                q += sign * AIRY_C[k] / zk;
            }
            zk *= zeta;
            sign = -sign;
        }
        (libm::sin(theta) * p + libm::cos(theta) * q) / (libm::sqrt(PI) * axp)
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
    const XBIG: f64 = 4.5;
    let sqrt3 = libm::sqrt(3.0_f64);

    if x > XBIG {
        // Large positive — growing exponential asymptotic.
        // DLMF §9.7.3: Bi(x) ~ exp(ζ)/(√π x^{1/4}) · Σ_{k≥0} c_k/ζ^k  (all positive).
        let xp = libm::pow(x, 0.25);
        let x32 = x * libm::sqrt(x);
        let zeta = (2.0 / 3.0) * x32;
        let mut p = 0.0_f64;
        let mut zk = 1.0_f64;
        for k in 0..AIRY_C.len() {
            p += AIRY_C[k] / zk;
            zk *= zeta;
        }
        libm::exp(zeta) * p / (libm::sqrt(PI) * xp)
    } else if x < -XBIG {
        // Large negative — oscillatory asymptotic.
        // DLMF §9.7.5: Bi(−ξ) ~ (cos θ P + sin θ Q)/(√π ξ^{1/4}),  θ = ζ + π/4.
        let ax = libm::fabs(x);
        let axp = libm::pow(ax, 0.25);
        let ax32 = ax * libm::sqrt(ax);
        let zeta = (2.0 / 3.0) * ax32;
        let theta = zeta + PI / 4.0;
        let mut p = 0.0_f64;
        let mut q = 0.0_f64;
        let mut zk = 1.0_f64;
        let mut sign = 1.0_f64;
        for k in 0..AIRY_C.len() {
            if k % 2 == 0 {
                p += sign * AIRY_C[k] / zk;
            } else {
                q += sign * AIRY_C[k] / zk;
            }
            zk *= zeta;
            sign = -sign;
        }
        (libm::cos(theta) * p + libm::sin(theta) * q) / (libm::sqrt(PI) * axp)
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
