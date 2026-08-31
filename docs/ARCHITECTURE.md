# Misutgaru architecture

Misutgaru retains the Misskey protocol, database lineage, API surface, and package layout where practical. The fork concentrates its divergence in the UI framework boundary, runtime efficiency, and a small set of user-facing extensions.

## Frontend path

```text
Vue application/state while migration is incomplete
  -> typed placement host
  -> compiled Vune View boundary
  -> fine-grained State dependency scheduler
  -> @vune-ui/web DOM renderer
  -> @vune-ui/animation motion ownership/scheduler
```

`packages/frontend/src/vune/compat-vue.ts` is intentionally transitional. Authored Vune Views now carry compiler-emitted legacy-host parameter plans, so primitive coercion and initializer mapping are mostly decided at compile time. `@vune-ui/compiler` exports `generateVueHostModule`, and its Vite plugin can materialize the matching pure-JS runtime placement module through a `.vune?vue-host` import. The physical generator retains consumer-visible `$props` typing; the query form deliberately emits no TypeScript-only syntax.

NIRAX route matching/navigation now lives in renderer-neutral `packages/frontend/src/lib/nirax-core.ts`. `packages/frontend/src/lib/nirax.ts` is the Vue binding that adds `shallowRef` state and component-lifecycle listener cleanup. This keeps current Vue routing behavior intact while allowing a future Vune router owner to consume the same navigation core without importing Vue runtime APIs.

Native Vune feature sources must not import Vue components or use raw host constructors. Browser-specific semantics should be expressed through Vune primitives first and the closed low-level Misutgaru native bridge only when the framework does not yet expose an equivalent.

## Fine-grained renderer

The web renderer associates State reads with View boundaries. A State update schedules the smallest safe boundary rather than blindly rerendering the entire root. Dirty boundaries are collected into one microtask and processed parent-first so an ancestor update can absorb redundant descendant work.

Compiled templates retain direct text/modifier patch paths where the compiler can prove them safe. Structural changes fall back to boundary reconciliation without losing State identity.

Development builds can enable the Vune DevTools overlay with `?vune-devtools=1` or Ctrl/Command + Shift + V. The instrumentation is disabled by default and records no boundary history while disabled.

## Timeline rendering path

Long Note lists keep logical entities separate from mounted DOM. `Paginator` can retain a bounded streaming identity window plus older fetched history, normalized Note/User/DriveFile entities reuse canonical references, PreparedNote prefetch shares MFM AST/URL work, and `useVariableVirtualList` mounts only a measured viewport window once the threshold is crossed. Row height measurements are keyed by Note identity rather than numeric position, so prepend/reorder and delayed ResizeObserver delivery cannot attach an old height to a different Note.

## Native web semantics

Vune core owns graph-first primitives for browser concepts that previously required raw host elements, including `TextEditor`, `FilePicker`, `ContentEditable`, `Canvas`, `Video`, `Audio`, `Svg`, `Path`, `FocusScope`, and `Popover`.

The web package owns DOM-only behavior such as focus trapping/restoration. This keeps feature Views renderer-oriented instead of embedding DOM construction throughout Misutgaru.

Detailed notes are composed from a reusable avatar/content renderer and a separate action-control renderer. `MkNoteDetailed` owns the surrounding layout, optional tabs, and thread context, so the thread window can show ancestor and continuation notes without repeating reply controls.

## Motion and layout

Misutgaru delegates per-element property ownership to Vune's `@vune-ui/animation` package. Starting a new opacity animation only replaces the opacity owner; transform, size, color, and other property owners remain independent.

Bare Vune `.animation()` is a compiler-assisted automatic motion domain. The compiler records the properties implied by the modifier chain, while the web renderer checks the actual DOM/style diff before scheduling work. Opacity, compositor transforms, paint/color, and layout changes can therefore choose separate default motion profiles and remain independently retargetable. Explicit `.animation(animation)` and `.animation(animation, value)` keep their authored timing and trigger semantics.

Vue compatibility surfaces that still need imperative enter/leave or keyframe motion use `packages/frontend/src/vune/motion.ts`, which is intentionally only a compatibility re-export of the shared Vune Web element-motion engine. Feature code must not create a second scheduler or bypass per-property ownership with direct `Element.animate()` calls.

Vune intrinsic layout animation snapshots geometry before and after a structural update and applies FLIP projection. The layout channel uses CSS `translate` and `scale` when available, leaving the normal `transform` channel available for user rotation/transform animation. Unsupported environments retain a conservative fallback.

## Fork package boundary

`packages/misutgaru-core` is the first dedicated fork package. It currently owns provider-neutral translation contracts/helpers and thread-window defaults. New fork behavior that does not need to live inside a Misskey implementation class should move here or into a future sibling package rather than increasing upstream-file diff size.

## Backend data path

```text
API / streaming / federation / queue
  -> shared Nest runtime graph
  -> services/entity packers
  -> request-scoped BatchLoader identity graph
  -> repository batches
  -> Redis + process-local cache
  -> CacheInvalidationService isolated pub/sub bus
```

Within an API request, `AsyncLocalStorage` gives the hot entity loaders one request-scoped `BatchLoader` instance. Note, draft, user, channel/poll and drive-file identity lookups can share this graph. The loader coalesces duplicate IDs even after a repository batch has started and memoizes settled values only until that request context is released. Process-long fallback loaders drop settled promises immediately, so request batching does not become a cross-request data cache.

PostgreSQL schema ownership stays entirely with vanilla Misskey. Misutgaru may change query scheduling, batching, Redis caching, and non-schema DataSource runtime options, but migrations, TypeORM entity schema sources, schema-shaping ID helpers, the entity registry, and DataSource schema options are fingerprinted against the matching vanilla source. See [DB_COMPATIBILITY.md](DB_COMPATIBILITY.md).

Redis cache writes are serialized per key. Each invalidation advances a generation, so an older Redis read cannot populate memory after a newer mutation. `CacheInvalidationService` publishes cache-name/key invalidations across backend processes after Redis becomes authoritative. It duplicates the existing subscriber connection instead of adding its channel to the shared Misskey stream subscriber, so unrelated stream listeners never see cache-control envelopes; remote cache listeners drop their memory tier and in-flight stale reads retry.

## Runtime and I/O

The existing Misutgaru runtime work remains in place: optional combined HTTP/queue Nest ownership, shared Redis/BullMQ connections where semantics permit it, CPU-aware concurrency defaults, cache-miss coalescing, batched entity packing, buffered/vector file writes, common block sizes, and demand-driven runtime statistics.

## Browser performance guard

`packages/frontend/test/e2e/performance.spec.ts` records DOM size, Long Task observations when supported, and navigation duration for an authenticated home flow. The thresholds are deliberately broad runaway guards rather than hardware-sensitive performance scores. Normal e2e execution includes the test; `pnpm --filter frontend test:e2e:performance` runs it directly.
