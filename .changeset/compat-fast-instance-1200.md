---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-functions': patch
---

Breaking: the `create(all)` instance holds only the mathjs-parity names as own keys. These are the 317 names that the mathjs 15.2.0 instance `create(all)` also has (`compat/src/parity-names.generated.ts`). The other 1089 names are inherited from prototype levels below the instance. Every name stays readable, assignable and enumerable.

Why: V8 keeps an object in fast mode only up to 1020 own properties. The instance had 1406, so every `math.x` read was a dictionary lookup. A read of `math.add` cost 18.0 ns per call on Node 26 and 17.7 ns on Node 22, against 9.5 and 10.6 ns for a detached `add`. Now the instance and each prototype level (at most 900 names) stay fast after creation, after every name is read, after `import` and after `config`. Measured with 2e7 reads of one own name and one name on each level, 3 runs: a read costs 2.4 to 7.2 ns on Node 26 and 4.2 to 10.1 ns on Node 22, against 14.8 to 27.4 ns and 13.4 to 19.0 ns before. The `compat-add` wall-clock gate median went from 1.48 to 1.70 down to 0.49 to 0.57 (3 runs each, Node 26). `tools/test/compat-fast-instance.test.mjs` pins this with `%HasFastProperties`.

Changed behaviour for the inherited names:

- `Object.keys(math)`, `Object.entries(math)`, `Object.values(math)` and `Object.getOwnPropertyNames(math)` give the 317 parity names only.
- A spread `{ ...math }` and `Object.assign({}, math)` copy the parity names only.
- `Object.hasOwn(math, name)` and `math.hasOwnProperty(name)` are false for an inherited name.
- `JSON.stringify(math)` writes the parity names only.
- `delete math[name]` does not remove an inherited name.
- `math.import(otherInstance)` imports the own keys of `otherInstance` only.
- An assignment to a name of a frozen instance throws a `TypeError`. Before, it changed the frozen instance.

Replacements: `for (const name in math)` lists all 1406 names, `name in math` is true for every name, and `math[name]` reads every name. `create(math)` with an instance as input now keeps every name, own and inherited.

`importFactory` of `@danielsimonjr/mathts-functions` now sees an inherited name as an existing name. A factory import of such a name without `override` gives "already exists", as for an own name.

Fixes #1200
