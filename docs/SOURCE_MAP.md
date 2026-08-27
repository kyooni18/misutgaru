# Source map

This is the human-oriented map of the fork. For exhaustive per-file indexing, use `scripts/generate-source-inventory.mjs`.

## Repository areas

| Path | What it does |
| --- | --- |
| `packages/frontend` | main browser UI, Vue/Vune migration, pages, components, widgets, motion and Material integration |
| `packages/backend` | API, federation, queues, entity packing, storage, cache, runtime and server behavior |
| `packages/sw` | service worker and Web Push behavior |
| `packages/misskey-js` | generated and handwritten JavaScript client SDK/types |
| `packages/frontend-shared` | frontend code shared across browser-facing packages |
| `packages/frontend-embed` | embedded-note and embed UI |
| `packages/frontend-builder` | frontend build pipeline |
| `packages/shared` | cross-package shared utilities/types |
| `packages/i18n` | localization build/runtime code |
| `packages/modules/Vune` | Vune submodule; may be empty in extracted archives |
| `packages/modules/o0o0o` | motion/runtime submodule; may be empty in extracted archives |
| `scripts` | repository validation, reporting, build and maintenance tools |
| `docs/archive` | historical snapshots only, not current truth |

## Frontend files that matter first

| File or area | Responsibility |
| --- | --- |
| `packages/frontend/vite.config.ts` | frontend build pipeline and Vune/Vue plugin order |
| `packages/frontend/src/vune/native.ts` | native Vune web primitives |
| `packages/frontend/src/vune/compat-vue.ts` | Vue placement bridge |
| `packages/frontend/src/vune/vue.ts` | legacy Vue compatibility path |
| `packages/frontend/src/vune/motion.ts` | shared migrated animation adapter |
| `packages/frontend/src/components/MkLoading.vue` and `.vune` peer | representative Vue shell to Vune-rendered leaf migration |
| `packages/frontend/src/components/MkWindow.vue` | window lifecycle and motion integration |
| `packages/frontend/src/components/MkModal.vue` | modal lifecycle and migrated animation behavior |
| `packages/frontend/src/components/MkThreadWindow.vue` | fork-specific resizable thread window |
| `packages/frontend/src/components/MkNote.vue` | note interactions, thread-window entry, translated image rendering |
| `packages/frontend/src/components/MkNoteDetailed.vue` | detailed note/thread loading and translated image output |

## Backend files that matter first

| File or area | Responsibility |
| --- | --- |
| `packages/backend/src/boot/common.ts` | constructs server, queue, or combined app contexts |
| `packages/backend/src/boot/master.ts` | selects runtime mode and owns process lifecycle |
| `packages/backend/src/core/QueueModule.ts` | BullMQ producer queues and shared Redis wiring |
| `packages/backend/src/queue/QueueProcessorService.ts` | worker construction and worker-side connection ownership |
| `packages/backend/src/misc/cache.ts` | generic cache and in-flight miss coalescing behavior |
| `packages/backend/src/misc/block-io.ts` | shared block-size policy for hot-path file I/O |
| `packages/backend/src/misc/FileWriterStream.ts` | buffered/vector file writes |
| `packages/backend/src/misc/BufferedTextFileWriter.ts` | text writer used by exporters |
| `packages/backend/src/daemons/ServerStatsService.ts` | demand-sensitive server statistics |
| `packages/backend/src/daemons/QueueStatsService.ts` | demand-sensitive queue statistics |
| `packages/backend/src/core/entities` | API entity serialization and new batch-packing work |
| translation service/API path | OpenAI-compatible translation, image context, DeepL fallback |

## Per-file inventory

Run:

```sh
node scripts/generate-source-inventory.mjs
```

If an upstream Misskey checkout is available:

```sh
node scripts/generate-source-inventory.mjs --upstream /path/to/misskey
```

The generated table records path, area, upstream delta classification, and a short purpose description for every indexed source/config file.