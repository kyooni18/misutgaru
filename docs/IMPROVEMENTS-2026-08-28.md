# Misutgaru framework and runtime improvement pass

Date: 2026-08-28

This checkpoint completes the stabilization work and then moves the project into compiler/renderer, cache-consistency, and fork-boundary improvements.

## Repository and CI

- resolved the active merge-marker/config failures from the incoming source;
- made Docker build local Vune source instead of assuming prebuilt framework output;
- added repository integrity, local-module verification, deterministic regression benchmark, and full verification commands;
- added the Misutgaru integrity workflow with recursive submodules, repository/type checks, focused cache regression tests, and deterministic motion work checks;
- regenerated the full source inventory and upstream delta;
- replaced mixed registry/local Vune package resolution with explicit local `link:` dependencies and made the normal root build prepare those modules before the application build.

## Vune compiler and Vue transition

- the Vune compiler emits a `legacyHost` initializer plan with names, labels, kinds, required state, and primitive coercion;
- `compat-vue.ts` compiles one adapter per host and consumes that generated plan instead of parsing primitive type strings on every render;
- `generateVueHostModule` generates a typed transitional Vue placement module from the same Vune semantic model, and the Vite plugin exposes a pure-JS runtime form of the same path through `.vune?vue-host`;
- the migration report keeps factual compatibility/native counts and remaining Vue features without maintaining a migration-priority scoring system.

## Fine-grained web renderer

- dirty Vune boundaries are batched into one microtask flush;
- boundaries are processed parent-first so an ancestor update can absorb redundant descendant work;
- existing State dependency tracking remains boundary-local and compiled template fast paths continue to patch text/modifiers directly when safe;
- optional DevTools recording tracks render count/time, State dependency count, DOM node count, parent relation, and compiled/reconcile mode.

## Native browser primitives

Vune core gained graph-first primitives for text editing, file selection, content-editable text, canvas, video/audio, SVG/path, focus scope, and popover behavior. DOM-only focus trapping/restoration lives in `@vune-ui/web` rather than feature Views.

The Misutgaru native escape hatch remains restricted instead of returning to arbitrary string-tag construction.

## Motion and layout

Layout FLIP projection now prefers independent CSS `translate` and `scale` channels. This lets an intrinsic size/position change animate without overwriting a simultaneous user `transform` such as rotation. Per-property animation ownership now lives in Vune's `@vune-ui/animation` package.

## Backend batching

`BatchLoader<K,V>` batches distinct same-turn keys and deduplicates repeated keys without creating a second long-lived cache. Note and note-draft entity lookups now fetch concurrent IDs through one `IN (...)` repository query.

## Cross-process cache consistency

Redis caches now use generation guards in addition to mutation serialization. Direct Redis reads, cache fills, and local memory writes are discarded/retried when a newer local or remote invalidation advances the generation.

`CacheInvalidationService` uses a dedicated Redis pub/sub channel and subscriber connection to fan out cache-name/key invalidations between backend processes after Redis becomes authoritative. Explicit local mutations remove the old memory value before waiting for Redis, and a remote event that arrives during a local write cannot be resurrected after the await resumes.

## Fork-owned package

`@misutgaru/core` now owns provider-neutral translation contracts/helpers and thread-window defaults. `OpenAiTranslationService` keeps provider transport and Misskey DI while consuming the fork package for request/response semantics. `MkThreadWindow.vue` consumes shared defaults from the same package.

This is intentionally a small first boundary rather than a mass move: future fork-only logic can migrate here without increasing upstream-file diff unnecessarily.

## Browser regression and DevTools

A Playwright performance regression spec records DOM node count, Long Tasks when the browser supports them, and navigation duration for an authenticated home flow. Thresholds are broad runaway guards rather than hardware-sensitive scores.

Development builds can enable the Vune DevTools panel with `?vune-devtools=1` or Ctrl/Command + Shift + V. The panel surfaces the most expensive active View boundaries and can reset its sample history.
