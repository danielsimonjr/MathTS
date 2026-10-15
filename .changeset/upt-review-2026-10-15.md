---
'@danielsimonjr/mathts-functions': patch
---

`gammaincp` computes the upper regularized incomplete gamma directly in the upper tail (modified Lentz continued fraction for x ≥ a + 1) instead of `1 − gammainc`, which rounded a far tail to 0 (`gammaincp(5, 80)` was 0; Q is 2.5e-28). `findRoot` refuses a `NaN` endpoint value (the sign check `fa · fb > 0` let it through) and takes `xtol`, a separate bracket-width tolerance (default `tol`; 0 stops on the residual alone). `quad` takes `atol`, its absolute panel floor (default the previous 1e-14), so an SI-scaled integrand can lower it. Found by the Universal-Physics-Tensor MathTS-usage review of 2026-10-15.
