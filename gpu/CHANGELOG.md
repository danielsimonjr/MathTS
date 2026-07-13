# @danielsimonjr/mathts-gpu

## 0.1.1

### Patch Changes

- **Fix: published types did not compile on current TypeScript.**

  Found by compiling the _actually-packed artifacts_ against TypeScript 7 with
  `skipLibCheck: false`, in a clean project — not by checking the repo, which passes for
  reasons a consumer does not share.

  - **Duplicate WebGPU identifiers.** `gpu`/`matrix` shipped a hard
    `/// <reference types="@webgpu/types" />`. TypeScript ≥ 7's `lib.dom` now declares WebGPU
    itself, so the reference collided (`TS2300: Duplicate identifier 'GPUCommandBufferDescriptor'`).
    The reference is gone; `@webgpu/types` is now an **optional peerDependency** — modern TS
    supplies the types from `lib.dom`, and consumers on older TS can add the package.
  - **`ObjectWrappingMap` / `PartitionedMap` did not implement `Map`.** They assigned
    `[Symbol.iterator]` in the constructor through a cast, so it never appeared in the emitted
    type: `implements Map<K, V>` was a lie that only broke downstream (`TS2420`). Both now
    declare a real `[Symbol.iterator]()` whose return type is **derived from `Map` itself**
    (`ReturnType<Map<K, V>[typeof Symbol.iterator]>`), so it stays correct across TS versions —
    older libs say `IterableIterator`, TS ≥ 5.6 says `MapIterator` (which also needs
    `[Symbol.dispose]`).
  - **`functions` shipped a dangling import.** Its emitted `.d.ts` referenced `../types/index.js`,
    but the package's `files` only included `dist/`, so the module did not exist for consumers
    (`TS2307`). `types/` is now shipped.
