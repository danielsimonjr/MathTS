---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-typed-function': patch
'@danielsimonjr/mathts-workerpool': patch
---

Declare `typed-function` and `workerpool` as registry `npm:` aliases (`npm:@danielsimonjr/typed-function@5.0.0-alpha.4`, `npm:@danielsimonjr/workerpool@10.2.1`) instead of `github:` git dependencies. npm 10 (bundled with Node 20 and 22) failed to install these packages with "git dep preparation failed ... Cannot read properties of null (reading 'edgesOut')". The registry builds are code-identical to the git HEADs that were resolved before, and the import names do not change.
