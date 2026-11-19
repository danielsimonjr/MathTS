---
'@danielsimonjr/mathts-compat': patch
---

`math.import(otherInstance)` on a compat instance throws one `TypeError` ("import of a math instance is not supported; import its functions (an object of functions or factories) instead"), also when the instance sits inside an array or object, and with `override` or `silent` (Refs #1222). mathjs 15.2.0 throws for every such call too, with messages that depend on the instance content. Before, on main: `create({}).import(create(all))` threw `Signature "Array" is defined twice`; `create(all).import(inst, {override:true})` threw `Factory, Object, or Array expected`; `{silent:true}` threw `Signature "Array" is defined twice`; `create(all).import(create(all))` threw `Cannot import "Chain": already exists`. `import({ T: [1, 2, 3] })` keeps the mathjs message `Factory, Object, or Array expected` (same in mathjs 15.2.0; with `silent` it is skipped). Plain objects, arrays and factories import as before.
