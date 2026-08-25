# Lightweight + Vune migration

This fork keeps two changes independent: a low-resource backend profile and a staged replacement of Vue-authored UI with Vune's SwiftUI-style syntax.

## Lightweight mode

The profile is enabled by default in this fork. Set `lightweightMode: false` to opt back into throughput-oriented defaults. Explicit tuning values always win over profile defaults.

For a small instance, the default runtime now also uses a single Node process and a single Nest application graph for HTTP and queue processing. This removes the second database pool, duplicate CoreModule service graph, duplicate caches, and most duplicate Redis clients without disabling federation or queue features.

```yaml
lightweightMode: true
singleProcessMode: true

db:
  maxConnections: 5

memoryCacheMaxEntries: 512
queueMetricsMaxDataPoints: 0
queueJobRetentionDays: 1
enableQueueStats: false
enableServerStats: false
enableCharts: true
```

| Setting | throughput profile | lightweight profile |
| --- | ---: | ---: |
| runtime graphs | server + queue separated | combined |
| PostgreSQL pool max | driver default | 5 |
| TypeORM Redis query cache | configured default | disabled |
| federation deliver concurrency | 128 | 8 |
| federation inbox concurrency | 16 | 2 |
| relationship concurrency | 16 | 2 |
| user webhook concurrency | 64 | 2 |
| system webhook concurrency | 16 | 2 |
| object storage concurrency | 16 | 2 |
| deliver rate/sec | 128 | 16 |
| inbox rate/sec | 32 | 4 |
| relationship rate/sec | 64 | 8 |
| outgoing HTTP sockets | agent default / explicit | 16 |
| idle outgoing HTTP sockets | agent default / explicit | 8 |
| channel note cache count | 1000 | 128 |
| per-user notification cache count | 500 | 64 |
| default local KV cache cap | unlimited | 512 |
| BullMQ metrics | 1 week | disabled |
| completed/failed queue retention | 7 days | 1 day |
| queue stats daemon | enabled | disabled |
| server stats daemon | enabled | disabled |
| chart daemon | enabled | enabled |

Redis clients for normal commands, publishing, timelines, and reactions are shared when their resolved Redis configuration is identical. A dedicated subscriber connection remains because Redis subscriber mode cannot safely execute normal commands. BullMQ keeps one dedicated unprefixed producer connection shared by all Queue objects, and one retry-forever command connection shared by all Worker objects; each Worker still owns the blocking duplicate BullMQ requires. Separate Redis configurations continue to create separate application clients.

Remote-user and federated-instance chart collection defaults to off for new databases, while local charts remain enabled. The migration changes database defaults only and intentionally does not overwrite an existing administrator's choices.

Optional heavy libraries are loaded on demand where practical: Meilisearch, mail rendering, S3, identicon/canvas, video probing, and several image-processing paths no longer need to enter the startup graph when the related feature is unused.

The profile keeps all queue workers required for federation, scheduled posts, maintenance, imports/exports, webhooks, and storage. It reduces their concurrency and metrics overhead rather than silently removing functionality. Busy public instances can set `lightweightMode: false`, keep `singleProcessMode: true` independently, or override individual values.

The backend memory diagnostic now measures `combined` mode by default. Set `MK_MEMORY_BACKEND_MODE=server` or `queue` for attribution. `MK_MEMORY_NO_DAEMONS=1` is available only for an intentionally daemon-free baseline.

## Vune compiler and Vue boundary

The frontend now uses the first-party Vune toolchain directly:

- `@vune-ui/vite` runs before the Vue plugin and only scans `*.vune.*` files.
- `@vune-ui/compiler` diagnoses/transforms raw SwiftUI-style sources.
- `@vune-ui/vue` owns rendering at the temporary Vue/Vune boundary.
- `packages/frontend/src/vune/vue.ts` only adapts Vune roots, legacy Vue components, and Vue-owned slots.
- `vue-tsc` excludes raw `.vune.ts` syntax; `pnpm typecheck:vune` checks it with the Vune compiler. `pnpm typecheck` runs both checks.

Author Vune UI with the compiler syntax instead of graph-call-only TypeScript:

```text
VStack(spacing: 12) {
  Text(title)
  HStack(spacing: 8) {
    Button("Retry") { retry() }
  }
}
```

Migration rules:

1. New/replaced UI lives in a nearby `vune/` directory as `*.vune.ts`.
2. Prefer Vune primitives and modifiers for all renderable structure.
3. Use `VueComponent(...)` only where the child is still Vue-only or relies on Vue-specific behavior.
4. Use `VueSlot(...)` only where the legacy caller still owns the slot.
5. Keep the old `.vue` path as a tiny compatibility shell while existing imports point at it.
6. Preserve behavior over syntax purity: transitions, teleports, directives, focus/lifecycle-heavy code, and third-party Vue controls stay Vue until Vune has a safe equivalent.
7. Do not mechanically convert a template if doing so changes event, slot, focus, or lifecycle semantics.

## Current migration slice

Run:

```sh
pnpm vune:check
pnpm vune:report
```

This checkpoint has 31 Vune source components. All migrated Vune sources use the real compiler path, and the set includes `ForEach` collection syntax as well as normal stack/group authoring. The migrated slice covers shared presentation primitives, form wrappers, search helpers, tab/tag UI, feature banners, grid row/cell pieces, and the custom-emoji log window. Components that still require Misskey-specific Vue behavior are embedded only at explicit fallback points.

This is still a staged migration rather than a claim that the whole frontend has been rewritten. Continue leaf/primitives first, shared controls second, page shells third, and transition/lifecycle-heavy components last. The report is intentionally rough but makes the remaining Vue-specific surface and fallback count visible so migration progress is measurable.

## Validation notes

Use Node 24 or another version satisfying the repository engine constraint. `scripts/check-vune.mjs` both diagnoses and transforms every Vune source; a passing diagnostic-only check is not considered enough. A full frozen offline pnpm install can still require registry metadata for unrelated dependencies when Misskey's supply-chain age policy is enabled, so the Vune 0.1.12 packages are explicitly listed in `minimumReleaseAgeExclude` while they are new.
