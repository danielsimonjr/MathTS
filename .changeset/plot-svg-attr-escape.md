---
'@danielsimonjr/mathts-plot': patch
---

Security fix: the SVG output now escapes every attribute value. Before this fix, a caller-supplied value (a layer or palette color, or a width or height passed as a string from JavaScript or a parsed notebook) was written into its attribute without escaping, so a value that contains a quote character could end the attribute and add attributes or elements to the SVG. All SVG elements are now built by one internal helper that passes every attribute value, numbers included, through a new `escAttr` escaper (`&`, `<`, `>`, `"`, `'`). The TikZ backend now writes a caller color only when it is a plain color name or an xcolor mix (letters, digits, `!`, `.`), and uses `black` otherwise. Output for ordinary inputs is byte-identical.
