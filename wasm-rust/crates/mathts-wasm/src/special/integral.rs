//! Integral and imaginary-error special functions — pure scalar kernels.
//!
//! Gap B P2 (see `docs/roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md`): `erfi`, the
//! exponential / sine / cosine / logarithmic integrals were absent from the
//! crate. Series + asymptotic expansions, ported from the JS reference.

use core::f64::consts::PI;

const EULER: f64 = 0.5772156649015329;

/// Imaginary error function `erfi(x) = (2/sqrt(pi)) * integral_0^x e^{t^2} dt`.
#[no_mangle]
pub extern "C" fn erfi(x: f64) -> f64 {
    let c = 2.0 / libm::sqrt(PI);
    let mut sum = 0.0;
    let mut term = x;
    let mut n = 0;
    while n < 100 {
        sum += term / (2.0 * n as f64 + 1.0);
        term *= x * x / (n as f64 + 1.0);
        if libm::fabs(term / (2.0 * n as f64 + 3.0)) < libm::fabs(sum) * 1e-15 {
            break;
        }
        n += 1;
    }
    c * sum
}

/// Exponential integral `Ei(x)`.
#[no_mangle]
pub extern "C" fn expIntegralEi(x: f64) -> f64 {
    if x == 0.0 {
        return f64::NEG_INFINITY;
    }
    if libm::fabs(x) <= 40.0 {
        // Series: Ei(x) = gamma + ln|x| + sum_{n>=1} x^n / (n*n!)
        let mut sum = 0.0;
        let mut term = 1.0;
        let mut n = 1;
        while n < 200 {
            term *= x / n as f64;
            sum += term / n as f64;
            if libm::fabs(term / n as f64) < libm::fabs(sum) * 1e-15 {
                break;
            }
            n += 1;
        }
        return EULER + libm::log(libm::fabs(x)) + sum;
    }
    // Asymptotic expansion for large |x|.
    let mut sum = 1.0;
    let mut term = 1.0;
    let mut n = 1;
    while n <= 30 {
        term *= n as f64 / x;
        sum += term;
        if libm::fabs(term) < 1e-15 {
            break;
        }
        n += 1;
    }
    (libm::exp(x) / x) * sum
}

/// Sine integral `Si(x) = integral_0^x sin(t)/t dt`.
#[no_mangle]
pub extern "C" fn sinIntegral(x: f64) -> f64 {
    if x == 0.0 {
        return 0.0;
    }
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let ax = libm::fabs(x);
    let mut sum = 0.0;
    let mut term = ax;
    let mut n = 0;
    while n < 100 {
        sum += term / (2.0 * n as f64 + 1.0);
        term *= -ax * ax / ((2.0 * n as f64 + 2.0) * (2.0 * n as f64 + 3.0));
        if libm::fabs(term / (2.0 * n as f64 + 3.0)) < 1e-15 {
            break;
        }
        n += 1;
    }
    sign * sum
}

/// Cosine integral `Ci(x)` (defined for `x > 0`).
///
/// The convergent power series is used up to `x = 25` (accurate to ~1e-11
/// there), and the standard asymptotic auxiliary-function expansion above —
/// where the asymptotic series' smallest term is already ~1e-10. (The JS
/// reference's asymptotic branch had an off-by-one recurrence that collapsed
/// `f` to `1/x`; this port uses the correct recurrence.)
#[no_mangle]
pub extern "C" fn cosIntegral(x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    if x <= 25.0 {
        // Series: Ci(x) = gamma + ln(x) + sum_{n>=1} (-1)^n x^{2n} / (2n*(2n)!)
        let mut sum = 0.0;
        let mut term = 1.0;
        let mut n = 1;
        while n < 200 {
            term *= -x * x / ((2.0 * n as f64 - 1.0) * (2.0 * n as f64));
            sum += term / (2.0 * n as f64);
            if libm::fabs(term / (2.0 * n as f64)) < 1e-16 {
                break;
            }
            n += 1;
        }
        return EULER + libm::log(x) + sum;
    }
    // Asymptotic: Ci(x) ~ f(x) sin(x) - g(x) cos(x), with
    //   f(x) ~ (1/x)  * sum_{n>=0} (-1)^n (2n)!   / x^{2n}
    //   g(x) ~ (1/x^2)* sum_{n>=0} (-1)^n (2n+1)! / x^{2n}
    let x2 = x * x;
    let mut f = 1.0;
    let mut g = 1.0;
    let mut f_term = 1.0;
    let mut g_term = 1.0;
    let mut n = 1;
    while n <= 25 {
        let nf = n as f64;
        f_term *= -(2.0 * nf) * (2.0 * nf - 1.0) / x2;
        g_term *= -(2.0 * nf + 1.0) * (2.0 * nf) / x2;
        f += f_term;
        g += g_term;
        if libm::fabs(f_term) < 1e-17 && libm::fabs(g_term) < 1e-17 {
            break;
        }
        n += 1;
    }
    (f / x) * libm::sin(x) - (g / x2) * libm::cos(x)
}

/// Logarithmic integral `li(x) = Ei(ln x)` (for `x > 0`, `x != 1`).
#[no_mangle]
pub extern "C" fn logIntegral(x: f64) -> f64 {
    if x <= 0.0 || x == 1.0 {
        return f64::NAN;
    }
    expIntegralEi(libm::log(x))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn near(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    #[test]
    fn erfi_values() {
        assert!(near(erfi(0.0), 0.0, 1e-15));
        assert!(near(erfi(1.0), 1.650425758797542, 1e-9));
        assert!(near(erfi(-1.0), -1.650425758797542, 1e-9));
        assert!(near(erfi(0.5), 0.6149520946965109, 1e-9));
    }

    #[test]
    fn exp_integral_ei() {
        assert!(expIntegralEi(0.0).is_infinite());
        assert!(near(expIntegralEi(1.0), 1.8951178163559368, 1e-9));
        assert!(near(expIntegralEi(2.0), 4.954234356001890, 1e-8));
        assert!(near(expIntegralEi(-1.0), -0.21938393439552029, 1e-9));
    }

    #[test]
    fn sine_integral() {
        assert!(near(sinIntegral(0.0), 0.0, 1e-15));
        assert!(near(sinIntegral(1.0), 0.9460830703671830, 1e-9));
        assert!(near(sinIntegral(-2.0), -1.6054129768026948, 1e-8));
    }

    #[test]
    fn cosine_integral() {
        assert!(cosIntegral(-1.0).is_nan());
        // Series branch (x <= 25) — checked against known values.
        assert!(near(cosIntegral(1.0), 0.3374039229009681, 1e-9));
        assert!(near(cosIntegral(2.0), 0.4229808287748649, 1e-8));
        assert!(near(cosIntegral(10.0), -0.0454564330044554, 1e-8));
        // Asymptotic branch (x > 25) — must stay bounded (~1/x), not diverge.
        let c60 = cosIntegral(60.0);
        assert!(c60.is_finite() && c60.abs() < 0.02, "Ci(60) = {c60}");
        let c100 = cosIntegral(100.0);
        assert!(c100.is_finite() && c100.abs() < 0.012, "Ci(100) = {c100}");
    }

    #[test]
    fn log_integral() {
        assert!(logIntegral(1.0).is_nan());
        assert!(near(logIntegral(2.0), 1.0451637801174927, 1e-8));
    }
}
