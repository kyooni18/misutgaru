# Source map

Use this file for architectural navigation and `docs/source-map/INVENTORY.md` for an exhaustive path-by-path index.

| Path | Responsibility |
| --- | --- |
| `packages/frontend` | Vue 3 browser application, routes, components, composables, and frontend tests |
| `packages/backend` | API, federation, queues, caches, entity packing, storage and runtime |
| `packages/misutgaru-core` | fork-owned contracts/helpers that should not live in upstream-shaped implementation files |
| `packages/recommendation` | standalone Rust timeline candidate generator/reranker and disposable SQLite feature index |
| `packages/sw` | service worker and Web Push lifecycle |
| `scripts` | repository checks, source inventory, upstream delta and regression benchmark |

## Frontend

| File | Responsibility |
| --- | --- |
| `packages/frontend/src/lib/nirax-core.ts` | renderer-neutral route matching, redirects, navigation state and events |
| `packages/frontend/src/lib/nirax.ts` | Vue binding for NIRAX refs and lifecycle-scoped listeners |
| `packages/frontend/src/components/MkNoteDetailed.vue` | note detail layout, thread context and optional additional sections |
| `packages/frontend/src/components/MkNoteDetailedContent.vue` | reusable detailed note avatar, author metadata and content renderer |
| `packages/frontend/src/components/MkNoteDetailedControls.vue` | reusable detailed note timestamp, reactions and action controls |
| `packages/frontend/src/components/MkThreadWindow.vue` | thread popup composition with ancestor and continuation notes |

Historical Vune migration implementation notes are retained only as archive/reference material; they are not part of the active frontend path.

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
| `packages/backend/src/core/RecommendationTimelineService.ts` | fail-open internal client for candidate discovery, Misskey-side hydration/filtering handoff, and final reranking |
| `packages/backend/src/misc/block-io.ts` | shared hot-path block-size policy |
| `packages/backend/src/misc/FileWriterStream.ts` | buffered/vector file writes |

## Regression and maintenance

| File | Responsibility |
| --- | --- |
| `packages/frontend/test/e2e/performance.spec.ts` | browser runaway-performance guard |
| `scripts/check-repository-integrity.mjs` | merge markers, package alignment, Docker contract and inventory checks |
| `scripts/generate-source-inventory.mjs` | exhaustive source index generation |
| `scripts/upstream-delta.mjs` | whole-tree comparison with the recorded Misskey upstream base |
| `UPSTREAM_BASE.json` | upstream reference metadata |

Regenerate the inventory with `node scripts/generate-source-inventory.mjs --upstream /path/to/misskey` after adding, moving, or removing implementation files.
