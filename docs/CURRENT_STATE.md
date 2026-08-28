# Current project state

Checkpoint date: 2026-08-28.

Misutgaru is a Misskey `2026.8.0-alpha.0` fork with a hybrid Vue/Vune frontend, an embedded Vune/o0o0o framework source checkout, backend runtime optimizations, and fork-specific thread, translation, and push behavior.

## Repository health

The source checkpoint is structurally clean. PostgreSQL compatibility is a hard same-version invariant: 426 vanilla-owned migration/schema sources plus the TypeORM entity registry and DataSource entity/migration configuration match the supplied vanilla `2026.8.0-alpha.0` snapshot at aggregate SHA-256 `e260f1f80d47e37e809dc0e57ac2b0e79387a2a0cee252609bc1ae3a81e9c4a7`. Misutgaru does not add its own PostgreSQL schema objects or migrations.


Direct Vune framework dependencies are pinned to this checkout with local `link:` targets for `vune-ui`, `@vune-ui/core`, `@vune-ui/vue`, `@vune-ui/web`, `@vune-ui/compiler`, and `@vune-ui/vite`. The root build runs `modules:build` first, so the compiler and renderer improvements in `packages/modules/Vune` are the exact code consumed by Misutgaru rather than a same-version registry package.

- no unresolved merge markers remain in the active tree;
- all three shipped example YAML configs parse;
- `scripts/check-vune-native.mjs` passes for every native-marked Vune source;
- all 233 frontend `.vune` sources transform with the current local Vune compiler;
- the delivered source archive includes the Vune and o0o0o module source rather than empty submodule directories;
- Docker builds Vune from source instead of requiring a prebuilt `packages/modules/Vune/dist` directory.

The final dependency-backed root `pnpm verify:full` still needs to be run in a normal networked checkout. The artifact workspace used for this pass could not reach the npm registry and did not contain the root pnpm virtual store.

## Current upstream delta

Against the supplied `misskey-develop` snapshot:

| Classification | Files |
| --- | ---: |
| Byte-identical | 2636 |
| Modified | 499 |
| Added | 765 |
| Removed | 2 |

The exhaustive source/config inventory currently contains 3446 rows in the local tree. The last upstream comparison recorded 3413 classified rows: 2227 identical, 482 modified, and 704 added relative to the supplied upstream source roots. See `docs/source-map/INVENTORY.md` and `docs/UPSTREAM_DELTA.md`.

## Frontend checkpoint

Run `pnpm vune:report` to refresh these values.

| Metric | Current value |
| --- | ---: |
| Vue SFC compatibility surface | 593 |
| Vune source components | 233 |
| Native Vune components | 65 |
| Explicit compatibility Vune shells | 2 |
| Legacy Vue placement shells using Vune | 227 |
| SwiftUI-syntax Vune files | 145 |
| Vune files using `ForEach` | 62 |
| Native share of Vune sources | 27.9% |
| Legacy-shell coverage of Vue SFCs | 38.3% |

Inside the 65 native sources, the current report shows zero `VueComponent`, `VueSlot`, raw `Element`, and `.vue` dependency fallbacks. `MkEmojiPicker.vune` and `MkPostFormSurface.vune` are explicitly classified as compatibility sources instead of inflating the native count.

## Framework/runtime improvements in this checkpoint

Vune now emits legacy-host binding metadata at compile time and exposes typed Vue-host code generation. The compiler can emit a typed transitional Vue placement module, while the Vite integration can compile a `.vune?vue-host` import directly into its pure-JS runtime counterpart, while the legacy Vue adapter compiles one binding plan per host instead of repeatedly interpreting initializer types during rendering. Three trivial placement shells use this generated path as executable integration coverage.

The web renderer batches dirty View boundaries in one microtask, processes parents first, and keeps fine-grained State subscriptions at the boundary that read them. Optional Vune DevTools instrumentation records body evaluations, dependencies, DOM node counts, and render time only when enabled.

Native browser primitives now cover text editing, file picking, content-editable text, canvas, video/audio, SVG/path, focus scopes, and popovers in addition to existing Vune controls. Layout FLIP uses independent CSS translate/scale channels so layout motion does not overwrite an unrelated user transform animation.

Backend entity lookups use a common request-scoped `BatchLoader`: note, note-draft, user, and drive-file single-ID pack paths now coalesce duplicate in-flight work and combine distinct IDs into repository `IN (...)` batches. Settled values are memoized only inside the current API request, while process-long fallback loaders remain freshness-oriented. Redis-backed caches use mutation serialization, generation guards, and a process-wide invalidation bus on an isolated subscriber connection so local memory tiers cannot silently outlive writes made by another backend process. Initial invalidation subscription failures are boundedly retried with diagnostics rather than leaving cross-process invalidation permanently disabled.

Long note lists now use stable-key variable-height virtualization backed by Vune's prefix measurement index, with ResizeObserver updates and scroll anchoring that preserves the visible row only after the user has scrolled away from the feed start. Prepared MFM/URL data can be prefetched in a Worker and reused across note surfaces, while a bounded normalized entity cache reuses canonical Note/User/DriveFile identities across timeline, thread and modal rendering.

Fork-specific translation contracts and thread-window defaults have started moving into `@misutgaru/core`, reducing direct fork logic embedded in upstream-shaped files.

## Verification performed in this workspace

- o0o0o Node suite: 111 passed;
- focused Vune compiler/web/runtime tests: 28 total, 23 passed, 5 optional React/jsdom compatibility cases skipped, 0 failed;
- native Vune boundary: 65 files passed;
- Vune source transform sweep: 233 passed, 0 failed;
- `@misutgaru/core` translation contract test passed;
- deterministic `BatchLoader` runtime harness passed;
- actual cache implementation race harness passed 5 generation/mutation cases across KV and single-value caches;
- actual cache invalidation service harness passed remote routing and verified that the shared Misskey stream subscriber receives no cache-control listener;
- motion regression committed exactly 122880 element states for 2048 elements over 60 frames and preserved independent property ownership.

See `docs/VERIFICATION-2026-08-28.md` for the exact validation boundary.
