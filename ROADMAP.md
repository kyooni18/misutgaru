# Misutgaru roadmap

This is the fork roadmap, not the upstream Misskey roadmap. The previous upstream-style roadmap is preserved under `docs/archive/upstream-misskey/ROADMAP.md`.

## 1. Restore a clean reproducible checkpoint

- resolve the four remaining merge-conflict-marker files;
- make the native Vune boundary check clean;
- initialize and pin Vune and o0o0o submodules in normal checkouts;
- run a lockfile-matched full build and refresh `docs/CURRENT_STATE.md`.

## 2. Continue Vune migration without hiding compatibility debt

- migrate stateless and low-state leaves first;
- replace compatibility wrappers with native Views where semantics exist;
- reduce `VueComponent`, `VueSlot`, raw-element, and `.vue` dependencies inside native trees;
- preserve behavior for transition, teleport, focus, directive, and complex-slot cases before removing Vue ownership.

## 3. Harden motion and Material

- keep independently animated properties isolated;
- validate spring, bezier, repeat, autoreverse, cancellation, retargeting, and reduced motion;
- move remaining matching translucent surfaces to shared Material tiers.

## 4. Prove backend optimization with tests

- verify RuntimeModule and single-process ownership;
- test BullMQ and Redis connection shutdown behavior;
- preserve cache coalescing and entity-packing batches;
- measure query counts and hot-path I/O.

## 5. Stabilize fork-specific features

- thread window behavior and loading;
- OpenAI-compatible translation, image translation, and DeepL fallback;
- Web Push VAPID rotation, subscription changes, multi-account behavior, and iOS PWA handling.

## 6. Keep documentation executable

- regenerate source inventory after source movement;
- update Vune counts from executable reports, not archived notes;
- refresh the vanilla delta after upstream rebases.