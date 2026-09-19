---
'@danielsimonjr/mathts-workbook': patch
---

Security fix: the TeX export no longer lets notebook text close a `verbatim` or `lstlisting` environment early. Code cell source, cell outputs, data cells and fenced Markdown code are written into these environments without escaping, so a body that contained the environment's own end sequence ended the environment and the rest of the body was read as LaTeX. Each such sequence in a body now gets a space after `\end`, so it prints as text. Chart output also takes the `@danielsimonjr/mathts-plot` attribute-escaping fix.
