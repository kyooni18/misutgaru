# Source map

Use this file for architectural navigation and `docs/source-map/INVENTORY.md` for an exhaustive path-by-path index.

| Path | Responsibility |
| --- | --- |
| `packages/frontend` | Vue/Vune browser application and migration shells |
| `packages/backend` | API, federation, queues, caches, entity packing, storage and runtime |
| `packages/misutgaru-core` | fork-owned contracts/helpers that should not live in upstream-shaped implementation files |
| `packages/sw` | service worker and Web Push lifecycle |
| `packages/modules/Vune` | checked-out Vune framework/compiler/web renderer source |
| `packages/modules/o0o0o` | shared motion engine and DOM property ownership source |
| `scripts` | repository checks, local module build, source inventory, upstream delta and regression benchmark |

## Vune/compiler/runtime

| File | Responsibility |
| --- | --- |
| `packages/modules/Vune/packages/compiler/src/pipeline.ts` | Vune lowering and compiler-emitted legacy-host metadata |
| `packages/modules/Vune/packages/compiler/src/vue-host.ts` | typed transitional Vue host code generation |
| `packages/modules/Vune/packages/core/src/web-primitives.ts` | graph-first browser primitives |
| `packages/modules/Vune/packages/web/src/dom.ts` | DOM reconciliation, fine-grained State boundary scheduling and DevTools recording |
| `packages/modules/Vune/packages/web/src/devtools.ts` | optional boundary profiling store |
| `packages/modules/Vune/packages/web/src/focus.ts` | focus-scope DOM behavior |
| `packages/modules/Vune/packages/web/src/motion.ts` | Vune web motion and layout FLIP integration |
| `packages/modules/Vune/packages/web/src/element-motion.ts` | shared imperative/keyframe motion bridge with per-property ownership for Vune and compatibility Vue surfaces |
| `packages/frontend/src/vune/compat-vue.ts` | transitional Vue placement host consuming compiler plans |
| `packages/frontend/src/vune/motion.ts` | thin compatibility re-export of the shared Vune Web element-motion engine |
| `packages/frontend/src/vune/devtools-overlay.ts` | development-only in-app Vune profiler panel |
| `packages/frontend/src/components/MkNoteDetailed.vue` | note detail layout, thread context and optional additional sections |
| `packages/frontend/src/components/MkNoteDetailedContent.vue` | reusable detailed note avatar, author metadata and content renderer |
| `packages/frontend/src/components/MkNoteDetailedControls.vue` | reusable detailed note timestamp, reactions and action controls |
| `packages/frontend/src/components/MkThreadWindow.vue` | thread popup composition with ancestor and continuation notes |

## Fork package

| File | Responsibility |
| --- | --- |
| `packages/misutgaru-core/src/translation.ts` | provider-neutral translation prompt/input/result contracts and parsing |
| `packages/misutgaru-core/src/thread.ts` | shared thread-window defaults |

## Backend hot paths

| File | Responsibility |
| --- | --- |
| `packages/backend/src/misc/cache.ts` | memory/Redis caches, generation guards and invalidation-bus hooks |
| `packages/backend/src/core/CacheInvalidationService.ts` | Redis pub/sub fan-out for cross-process cache invalidation |
| `packages/backend/src/misc/loader.ts` | DebounceLoader and same-turn BatchLoader |
| `packages/backend/src/core/entities/NoteEntityService.ts` | note serialization and batched note lookup |
| `packages/backend/src/core/entities/NoteDraftEntityService.ts` | draft serialization and batched draft lookup |
| `packages/backend/src/core/OpenAiTranslationService.ts` | provider transport using `@misutgaru/core` contracts |
| `packages/backend/src/misc/block-io.ts` | shared hot-path block-size policy |
| `packages/backend/src/misc/FileWriterStream.ts` | buffered/vector file writes |

## Regression and maintenance

| File | Responsibility |
| --- | --- |
| `packages/frontend/test/e2e/performance.spec.ts` | browser runaway-performance guard |
| `scripts/benchmark-regressions.mjs` | deterministic DOM/motion work and property-ownership regression |
| `scripts/check-repository-integrity.mjs` | merge markers, package alignment, Docker contract and inventory checks |
| `scripts/generate-source-inventory.mjs` | exhaustive source index generation |
| `scripts/upstream-delta.mjs` | whole-tree comparison with the recorded Misskey upstream base |
| `UPSTREAM_BASE.json` | upstream reference metadata |

Regenerate the inventory with `node scripts/generate-source-inventory.mjs --upstream /path/to/misskey` after adding, moving, or removing implementation files.
