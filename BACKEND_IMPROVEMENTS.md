# Misutgaru backend improvement report

Date: 2026-08-28 (source checkpoint)
Scope: `packages/backend/`, `packages/misutgaru-core/`, backend-related scripts and CI.
Method: direct source inspection at the current checkpoint, cross-checked against
`docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/RUNTIME_OPTIMIZATION.md`,
`docs/DB_COMPATIBILITY.md`, and `docs/UPSTREAM_DELTA.md`.

This report is a prioritized recommendation list, not a change plan. Every item
respects the fork's hard constraints: the PostgreSQL schema stays byte-identical to
vanilla Misskey (no fork migrations, no new schema objects), fork logic is kept out
of upstream-shaped files where practical, and regression gates stay deterministic
(query/fetch counts, ownership, committed work) rather than wall-clock timing.

---

## Executive summary

The backend's core runtime work is solid and unusually well-gated for a fork:
request-scoped `BatchLoader` batching, generation-guarded Redis caches with a
dedicated cross-process invalidation bus, a fingerprint-locked vanilla schema,
bounded process-local diagnostics, and a CI integrity workflow. A scan of the entity
packers found essentially no remaining per-item repository queries in hot pack paths.

The highest-value improvements concentrate in four places:

1. **The fork-specific `notes/translate` endpoint is an unbounded paid-LLM cost
   vector** (no rate limit, no per-user quota, no result caching, in-request image
   processing, per-request remote image downloads). This is the single most
   important backend gap.
2. **A 23 MB `db.tar.gz` sits untracked and non-ignored at the repository root** —
   a data-leak and source-export hazard that contradicts the repository's own
   no-secrets rule.
3. **Cross-process cache invalidation is keyed on `config.host`**, which silently
   breaks invalidation fan-out whenever server and queue roles run with different
   host values.
4. **The streaming/WebSocket pack path bypasses the request batch context**, so
   streamed note/user events re-query the database instead of coalescing.

Everything else is incremental: deduplicating a double role-policy fetch in the note
create path, registering the remaining process-local memory caches with the
invalidation bus, extending the deterministic regression gates to backend query
counts, and continuing the fork-boundary move into `@misutgaru/core`.

---

## Verified current state (do not regress)

These behaviors are implemented, tested, and documented. They are the baseline any
improvement must preserve:

- **Request-scoped batching.** `packages/backend/src/misc/loader.ts`
  (`BatchLoader<K,V>`) coalesces distinct same-microtask keys into one repository
  batch, deduplicates duplicate keys even while a batch is in flight, and memoizes
  settled values only inside the `AsyncLocalStorage` request context
  (`packages/backend/src/misc/request-batch-context.ts`). Process-long fallback
  loaders drop settled values so they never become a stale app cache. Note,
  note-draft, user, channel, poll, poll-vote, and drive-file single-ID pack paths
  all consume it (`packages/backend/src/core/entities/NoteEntityService.ts`,
  `UserEntityService.ts`, `DriveFileEntityService.ts`, `NoteDraftEntityService.ts`).
- **Redis cache correctness.** `packages/backend/src/misc/cache.ts`
  (`RedisKVCache`, `RedisSingleCache`) combines in-flight fetch coalescing,
  per-key write serialization, generation counters that discard stale in-flight
  reads/fills, and `CacheInvalidationService` fan-out over a dedicated pub/sub
  channel on an isolated duplicate subscriber connection
  (`packages/backend/src/core/CacheInvalidationService.ts`) with bounded
  exponential-backoff retry and shutdown cancellation.
- **Schema invariant.** 426 vanilla-owned migration/entity/schema sources plus the
  entity registry and DataSource schema options are fingerprint-locked
  (`scripts/db-schema-invariant.json`, `pnpm verify:db-schema`). Misutgaru adds no
  schema objects.
- **Runtime diagnostics.** Process-local, bounded (256 metrics / 128 traces),
  lazy event-loop histogram, exposed only through the moderator-gated
  `admin/runtime-diagnostics` endpoint.
- **Process graph.** `singleProcessMode` (default when `clusterLimit` is unset or
  ≤ 1) hosts HTTP and queue in one Nest graph; explicit split-role and clustered
  deployments remain supported (`packages/backend/src/boot/master.ts`).
- **Fork surface is small.** Only 13 backend files are added by the fork and 140
  are modified (see `docs/UPSTREAM_DELTA.md`). Added files: `RuntimeModule.ts`,
  `CacheInvalidationService.ts`, `OpenAiTranslationService.ts`,
  `misc/{block-io,BufferedTextFileWriter,redis-event,request-batch-context,runtime-diagnostics}.ts`,
  `admin/runtime-diagnostics.ts`, and three unit tests.
- **CI.** `misutgaru-integrity.yml` runs the DB invariant, `verify:repo`, the
  Misutgaru backend regression suite (`test:misutgaru-regressions`), and the
  deterministic motion benchmark on every push/PR.

---

## P0 — Fix before the next release

### 1. `notes/translate` is an unbounded paid-LLM cost vector

**Evidence**

- `packages/backend/src/server/api/endpoints/notes/translate.ts` declares
  `requireCredential: true` and a `canUseTranslator` role-policy gate, but its
  `meta` has **no `limit`**. `ApiCallService` applies rate limiting only when
  `ep.meta.limit` is present (`packages/backend/src/server/api/ApiCallService.ts`
  around line 318; `endpoints.ts` documents that an omitted `limit` means "no
  limitation"). Any authenticated user with the policy can call it without bound.
- Every call does, in the request path:
  - up to **8 sequential parent-note fetches**, each followed by an individual
    `isVisibleForMe` visibility check (`getThreadContext`, lines 80–95);
  - up to **4 image downloads** via `httpRequestService` (8 MB cap, 15 s timeout
    each) followed by **CPU-bound `sharp` resize** (768 px JPEG, quality 55) on the
    event loop (`getImageContext`, lines 97–125);
  - a **paid OpenAI chat-completions call** (30 s timeout, vision-capable
    `gpt-4o-mini` default) with the base64 images in the request body
    (`packages/backend/src/core/OpenAiTranslationService.ts`).
- For federated notes the "image URL" is a **remote URL**, so the same remote image
  is re-downloaded on every translate request. For local notes the code performs an
  HTTP round-trip through the instance's own file endpoint instead of reading the
  on-disk thumbnail.
- There is **no result caching**: translating the same note twice (or with two
  clients) pays twice. There is **no per-user daily quota** and **no cost
  observability** in runtime diagnostics.
- With `singleProcessMode` on by default, this CPU work (sharp) and these long
  outbound calls share the event loop with HTTP serving and queue processing.

**Recommendations (in order of impact)**

1. Add `meta.limit` to the endpoint (e.g. `duration: 60_000, max: 5` per user with
   a shared `key: 'translate'`) so the standard rate limiter applies.
2. Add a per-user daily quota using a Redis counter with TTL (e.g.
   `misutgaru:translate:quota:<userId>`, INCR + EXPIRE, bounded lifetime). Redis
   state is explicitly allowed by `docs/DB_COMPATIBILITY.md` and requires no schema
   change. Return a distinct `meta.errors` entry when exhausted.
3. Cache translation results in Redis keyed by
   `(noteId, targetLang, note.updatedAt)` (or a content hash of the translated text
   window) with a bounded TTL, so repeat requests are free.
4. Move image preparation out of the request path: for local files, read the
   on-disk thumbnail directly (no HTTP round-trip); consider pre-resizing at upload
   time or queueing the vision call. Cap image count and total payload size.
   For remote files, at minimum reuse the already-served thumbnail bytes rather
   than re-fetching the original.
5. Add bounded runtime-diagnostics counters: translation calls, provider errors,
   provider latency distribution, per-day call count. This makes cost visible in
   the existing admin diagnostics page without new persistence.
6. Optionally batch the thread-context walk: the 8-deep chain is inherently
   sequential, but the per-parent visibility checks can be collected and evaluated
   in one pass, and parent fetches can go through the request-scoped note loader
   instead of `GetterService`.

### 2. Untracked 23 MB `db.tar.gz` at the repository root

**Evidence**

- `db.tar.gz` (23 MB, root-owned, dated 2026-08-27) exists at the repository root,
  is **not** in `.gitignore` (`git check-ignore` reports it as not ignored), and is
  untracked.
- `AGENTS.md` forbids committing secrets, production config values, and API keys;
  a database tarball is at least as sensitive. It is also a source-export hazard:
  `scripts/export-source.sh` / `scripts/tarball.mjs` and repository-integrity
  scans operate from this root.

**Recommendations**

1. Delete the file or move it outside the repository (and verify whether it
   contains production data; if so, treat as a leak and rotate anything inside).
2. Add `db.tar.gz` (or a broader `*.tar.gz` rule for the root) to `.gitignore`.
3. Extend `scripts/check-repository-integrity.mjs` to fail on large untracked
   binary artifacts (e.g. any untracked file > 1 MB that is not in a known
   allowlist), so this class of hazard is gated in CI.

---

## P1 — Correctness and hot-path performance

### 3. Cache invalidation channel is keyed on `config.host`

`CacheInvalidationService` publishes on
`${config.host}:misutgaru:cache-invalidation:v1`. In split-role or multi-domain
deployments the server and queue roles can legitimately run with different `host`
values (different config files, different public URLs). When that happens, the two
processes subscribe to **different channels** and cross-process invalidation
silently stops working — exactly the failure mode the generation guards were built
to prevent, but only for the local process.

**Recommendation:** key the channel on a stable instance/deployment identifier that
is identical across all roles of the same deployment (e.g. a new explicit
`cacheInvalidationChannel` config key, falling back to `config.id` or a
deployment-scoped constant), and log a warning at boot when the resolved channel
differs from a value persisted in Redis by another role. Add a unit test that
constructs two service instances with different `host` values and asserts they
still share a channel.

### 4. Process-local memory caches in `CacheService` bypass the invalidation bus

`CacheService` registers all seven Redis-backed caches with the invalidation bus,
but the four standalone `MemoryKVCache` tiers — `userByIdCache`,
`localUserByNativeTokenCache`, `localUserByIdCache`, `uriPersonCache` (5-minute
TTL) — are constructed with no bus registration (`packages/backend/src/core/CacheService.ts`,
constructor). The `memoryKvCaches` registry in `misc/cache.ts` exists only for GC.
So a user suspension, token invalidation, or profile change made through another
backend process is invisible to this process's memory tier for up to the TTL.

This is inherited upstream behavior, but it contradicts the fork's own stated
principle that "local memory tiers cannot silently outlive writes made by another
backend process" (which the Redis tiers now honor).

**Recommendation:** register these four caches with `CacheInvalidationService`
(the bus listener can call the existing `delete(key)`), or, if the TTL-bounded
staleness is deliberately accepted for these tiers, document that decision in
`docs/RUNTIME_OPTIMIZATION.md` and add a diagnostics counter for TTL-expired
invalidations so the staleness is observable.

### 5. Streaming/WebSocket packs bypass the request batch context

`requestBatchContext.run(...)` is established only in `ApiCallService` (REST path).
The streaming service packs entities directly —
`packages/backend/src/server/web/ClientServerService.ts` lines 535, 596, 805, 835
(`userEntityService.pack`, `noteEntityService.pack`) — with no batch context.
Those packs therefore fall back to the process-long loaders, which drop settled
values: each streamed note/user event re-queries the database, and a burst of
events (note with 10 attachments, mass renote fanout) issues per-entity queries
that the REST path would have coalesced.

**Recommendation:** wrap streaming event handling (per channel, per event batch,
released after the flush) in a bounded `requestBatchContext.run(...)` scope, mirroring
the REST path. Keep the scope lifetime short so streamed data never becomes a
cross-event cache; this is the same freshness contract the process-long loaders
already provide. Add a regression test asserting that a burst of streamed note
events for the same user produces one user lookup (query-count gate, not timing).

### 6. `NoteCreateService` fetches role policies twice and serializes independent fetches

In the `create` path, `this.roleService.getUserPolicies(user.id)` is awaited at
around line 476 (sensitive-word/visibility check) and again at around line 638
(mention-limit check). Each call re-runs `getUserRoles` → `getUserAssigns`
repository work. Additionally, several independent single-entity fetches (renote,
reply, channel, blocking existence) run sequentially where they do not depend on
each other.

**Recommendation:** fetch `getUserPolicies` once near the top of `create` and
reuse the result; parallelize the independent existence/entity fetches with
`Promise.all`. This is a small, low-risk change to the hottest write path in the
backend. Add a query-count regression test for `notes/create` (public note with
reply + renote + files) so the batching stays.

### 7. Export processor fallback query inside the per-note loop

`packages/backend/src/queue/processors/ExportNotesProcessorService.ts` (around
line 94): the per-note loop falls back to
`pollsRepository.findOneByOrFail({ noteId })` when a note with `hasPoll` has no row
in the pre-batched `pollsByNoteId` map. The batch above it already fetches all poll
rows for the page, so the fallback only fires on a race (poll added between page
fetch and loop) — but when it does, it is a per-note query inside a streaming
export.

**Recommendation:** on the fallback miss, re-fetch the missing poll IDs as one
batched `findBy({ noteId: In(...) })` for the affected notes (or simply skip the
poll with a logged warning, matching the "export is a snapshot" semantics). Minor,
but it is the only loop-adjacent single-entity query found in a full scan of the
backend source.

---

## P2 — Architecture, hygiene, and fork boundary

### 8. Continue moving fork logic into `@misutgaru/core`

The fork currently modifies 140 upstream backend files and adds 13. Translation
contracts and thread-window defaults already live in `packages/misutgaru-core`.
Candidates for the next moves (each should be a small, reviewable extraction, not a
mass move):

- push-notification lifecycle policy (TTLs, expiry handling) out of
  `PushNotificationService` into a provider-neutral contract;
- the hybrid-timeline query construction (fork-added endpoint
  `notes/hybrid-timeline.ts`) into a shared query helper if it is reused;
- diagnostics metric naming conventions as a shared constant module.

This keeps the upstream delta small, which is what makes future vanilla merges
tractable.

### 9. Validate fork-added config keys

`packages/backend/src/config.ts` (431 lines) is hand-rolled. Fork-added keys
(`singleProcessMode`, `threadPoolSize`, `deliverJobConcurrency`,
`inboxJobConcurrency`, `relationshipJobConcurrency`, `userWebhookJobConcurrency`,
`systemWebhookJobConcurrency`, `openaiTranslation.*`) are merged with defaults
inline. Two concrete risks:

- a typo'd fork key is silently ignored (no unknown-key detection);
- `openaiTranslation.apiKey` can come from the `OPENAI_API_KEY` environment
  variable and then lives in the compiled config object — verify
  `scripts/compile_config.js` and any config logging path never emit it.

**Recommendation:** add a small zod (or equivalent) schema for the fork-added key
namespace with fail-fast on unknown keys, keep upstream keys as-is to minimize
delta, and add a unit test that the config loader rejects a typo'd
`openaiTranslation` key and never serializes the API key.

### 10. `packages/shared` is effectively empty

`packages/shared/` contains only `package.json` and `eslint.config.js`. If it is a
placeholder for future shared contracts, say so in a README; otherwise remove it
so the package graph is not misleading. (New fork contracts should go to
`packages/misutgaru-core` per `AGENTS.md`, not a new generic package.)

### 11. VAPID key handling

Push notifications store VAPID keys in the database via the admin UI
(`docs/PUSH_NOTIFICATIONS.md`). That is acceptable, but for operational flexibility
(air-gapped key generation, secret managers) support an environment-variable
override for the VAPID private key, and add an integrity check that the private
key never appears in config files, exports, or logs — consistent with the
no-secrets rule.

### 12. Keep `singleProcessMode` trade-offs documented

The default single-process mode means request-path CPU work (image processing,
sharp, JSON) and queue work share one event loop. The diagnostics endpoint already
exposes event-loop delay, which is the right instrument. Document the expected
event-loop-delay profile for single-process vs split deployments in
`docs/RUNTIME_OPTIMIZATION.md` so operators can decide when to split roles, and
make the P0-1 image-work move (out of the request path) which shrinks the worst
case.

---

## Testing and verification gaps

1. **Backend query-budget gates.** The repository's regression philosophy
   (deterministic counts, not wall-clock) is currently enforced only for the
   motion/DOM path (`scripts/benchmark-regressions.mjs`). Extend it to the backend:
   unit-level tests with mocked repositories that assert fetch/batch counts for the
   hot endpoints — home timeline pack of 30 notes, `notes/create` (public, reply,
   renote, files), `users/show`, and a streamed-event burst. These tests are cheap,
   deterministic, and directly protect the `BatchLoader` investment.
2. **Entity packer golden tests.** Fork-critical infrastructure (loader, caches,
   invalidation, request context, diagnostics) is well tested, but the packers
   themselves have thin coverage (DriveFile, User entity tests exist; NoteEntity
   pack output is untested). Add golden-output tests for `NoteEntityService.pack`
   and `UserEntityService.pack` (single + many) so upstream merges that touch
   packing are caught.
3. **Translate endpoint e2e.** Add an e2e/unit test for `notes/translate` with a
   mocked OpenAI transport covering: policy denial, unavailable, no-such-note,
   invisible note, quota exhaustion (after P0-1), and result-cache hit.
4. **Multi-process invalidation test.** The current `CacheInvalidationService`
   harness covers routing and retry. Add a test with two full service instances
   (two "processes") asserting that a local mutation in one drops the memory tier
   in the other, including the P1-3 channel-keying fix.
5. **`pnpm verify:full` is still pending.** Per `docs/CURRENT_STATE.md`, the
   dependency-backed root verification (full typecheck, full Vitest tree,
   production build) has not been run in a networked checkout. Run it before
   describing any release as fully validated, and run the production Docker build
   from a clean recursive-submodule checkout.
6. **Diagnostics coverage.** Queue depth/latency and translation cost/latency are
   not in the runtime diagnostics snapshot. Add them (bounded, process-local) so
   the admin page covers the two areas this report flags most.

---

## Constraints to respect while implementing

- **No schema changes.** Everything above uses Redis with bounded lifetime,
  process-local memory, or existing vanilla representations — all explicitly
  permitted by `docs/DB_COMPATIBILITY.md`. Do not add tables, columns, indexes, or
  migrations.
- **Upstream delta discipline.** Prefer extracting fork logic into
  `packages/misutgaru-core` over editing more upstream-shaped files. Keep the 13
  added files small and the 140 modified files as small as behavior allows.
- **SPDX headers** on any new `.ts` files (`node scripts/check-spdx.mjs`).
- **Inventory regeneration** if files are added/moved/deleted
  (`node scripts/generate-source-inventory.mjs`).
- **misskey-js regeneration** (`pnpm build-misskey-js-with-types`) if the
  `notes/translate` or `admin/runtime-diagnostics` endpoint contracts change.
- **Do not edit merged migrations**; do not commit secrets; do not force-push
  shared branches.

---

## Suggested sequencing

| Step | Items | Rationale |
| --- | --- | --- |
| 1 (immediate) | P0-2 (`db.tar.gz` cleanup + integrity guard) | Zero-risk hygiene; removes a live leak hazard. |
| 2 (this week) | P0-1 (translate endpoint: limit, quota, result cache, image path) | Bounded-cost fix for the only unbounded paid external call in the backend. |
| 3 (next) | P1-3 (invalidation channel keying) + P1-4 (memory cache registration) | Correctness of the fork's own cache-consistency story. |
| 4 (next) | P1-5 (streaming batch context) + P1-6 (note create dedup) | Hot-path query reduction with deterministic regression tests. |
| 5 (ongoing) | P1-7, P2-8…P2-12, testing gaps 1–6 | Incremental; each is small and independently reviewable. |

Before any release: `pnpm verify:full` in a networked checkout, then the
production Docker build from a clean recursive-submodule checkout.
