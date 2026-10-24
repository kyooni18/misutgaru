# Misskey 2026.10.1 integration

## Preservation and ancestry

- Original `main`: `b4da88d29158c65a3141671644710e4033f41666`, 48 commits ahead of `origin/main`.
- No initially staged changes; 20 modified tracked files and one untracked emoji-search helper.
- Local work was restored byte-for-byte in an isolated worktree and committed as `9f6ce6ed94` before integration. The original worktree was left untouched during verification.
- Private backup outside the repository: `~/Code/misutgaru-backup-20261024-223756`. Contains a verified full-history Git bundle, binary staged/unstaged patches, status, an untracked-file archive, the complete ignored Mün checkout, private local configuration, the active ignored compose file, and a custom-format live database dump with checksum and restore TOC. Do not publish this directory.
- Official tag `2026.10.1` was fetched directly from `https://github.com/misskey-dev/misskey.git`; `git ls-remote` confirms `4840fa6d576128ba916ba69169258ca177d40faf`. This is a lightweight tag, not a signed tag.
- The fork has **unrelated imported history**, rooted at `6ae103edb1` (2026.8 alpha). There is no actual Git merge base with upstream. `UPSTREAM_BASE.json` and schema/source history identify the previously adopted content baseline as official `2026.9.0` (`bd9eb7c77942ef11749a04e7a5f24bee935d764b`).
- Integration uses Git's real three-way `merge-tree --write-tree --merge-base=2026.9.0`, with the fork snapshot and official release as the two sides, followed by reviewed conflict resolutions. The final merge records both parents, retaining the **entire** official release ancestry and all fork history; no source-snapshot replacement, graft, history rewrite, or remote push is used.

## Architectural differences retained

The active application remains Vue 3 with NIRAX lifecycle bindings, Mün workspaces (`@mun/*`), ProgressiveBlur, fork navigation/header/post-form/motion styling, decomposed detailed notes and thread popups. Mün is an ignored independent local repository at `6507506`, not an upstream Misskey package; builds need that existing checkout. Vune is not reintroduced.

Backend divergence includes request-scoped BatchLoader packing, shared Redis/Bull ownership, generation-guarded Redis/local caches with cross-process invalidation, normalized frontend entity caching, buffered block I/O, a shared streaming user-state/last-active scheduler, role-policy fast paths, translation contracts, recommendation integration, push recovery and subscription cache invalidation, and split-role/single-process compatibility. PostgreSQL schema ownership remains exclusively vanilla Misskey.

## Conflict decisions (32 files)

| Files | Resolution |
| --- | --- |
| Four package manifests; workspace and lockfile (6) | Upstream dependency upgrades and Sentry 11; retain all fork workspace dependencies and newer local Vite. Keep Nest test/platform peers on the same major. Regenerate lock with actual pnpm 12.14.0. Preserve security overrides; advance Summaly's Fastify override to 5.12.7. |
| HashtagService | Port bounded `normalizeTag` normalization to the batched implementation, including hidden tags. |
| PushNotificationService | Use upstream checked HTTPS agent without losing TTL, 404/410 cleanup, payload bounding, or distributed cache invalidation. Reject malformed/non-HTTPS endpoints before sending. |
| UserFollowingService | Account-age approval checks, bulk profiles/followers, and batched pending-request recheck to avoid accepting cancellations; no per-user query loop. |
| ApRequestService | Sign pathname **and query**, including an empty `?`, excluding fragments. |
| ChartManagementService | Upstream error-isolated `saveAll`, retain fork shutdown ownership. |
| postgres.ts | Keep fork removal of TypeORM query cache; upstream's Redis option correction is inapplicable to this deliberately absent runtime cache. Entity/migration registry is byte-equivalent. |
| ExportCustomEmojisProcessorService | Upstream safe sequential ZIP API and duplicate-filename handling, with async file cleanup and fork buffered metadata writes. Port block batching into the new ZIP writer, retaining traversal/symlink/size/duplicate protections. |
| ApiCallService | Upstream multipart abort/error handling using buffered output; anonymous default-policy authorization with fork role hints and request BatchLoader context. |
| StreamingApiServerService; stream/Connection | Upstream payload/compression limits; preserve equivalent shared refresh/last-active scheduler instead of adding per-user/per-connection timers or duplicate state. |
| sw/unregister | Same auth/publickey/endpoint ownership proof, one hourly limit, account-scoped deletion when authenticated, all matching browser accounts otherwise, distributed invalidation retained. |
| users/show | Visitor-local filtering plus fork batch packing and indexed result ordering. |
| FileServerUtils; FileServerService test | Content-Length/Range fixes with larger sequential read buffers; combine new mocks and fork test types. |
| FeedService | New hidden-before/followers-only-before filtering plus batched drive file hydration. |
| MkNoteDetailed; MkNoteMediaGrid; MkUserPopup | Preserve split detailed-note UI, custom lightbox types and component imports, port shared utility paths and URL-preview behavior. |
| MkPushNotificationAllowButton; signout | Retain browser/iOS readiness, VAPID recovery, safe key encoding and awaited unsubscribe; behavior matches upstream RFC 8291 ownership proof. |
| MkMfm | Adopt upstream shared renderer with the fork's precomputed sparkle/link slots preserved there; no duplicate renderer. |
| flash, scratchpad, WidgetAiscript, WidgetAiscriptApp, WidgetButton (5) | Upstream async error reporting and distinguish syntax, execution and internal errors. |

Semantic auto-merge corrections also include AntennaService's returned matched list, removal of a duplicate streaming map, callback `return` instead of loop `continue` in push delivery, and imports in fork-only detailed-note components/tests after upstream utility moves. No locale translations were manually edited.

## Security behavior integrated

Complete 2026.9.1 / 2026.10.0 / 2026.10.1 history includes remote-user-update authorization, federation follower/following visibility, SSRF-protected download agents reselected on redirects, note visibility/diffs and visitor UGC restrictions, WebSocket limits, role-policy enforcement for visitors, safe archive processing, sensitive avatar/banner restrictions, local-only emoji restrictions on remote renotes, room invitation block checks, normalized URL forbidden-word checks, dependency security upgrades, and HTTP Signature query canonicalization.

Sentry 11.8.0 uses restricted `dataCollection` defaults (no automatic user info, cookies, query tokens, bodies, query values or peer-identifying headers), warns about removed `sendDefaultPii`, and uses session-based profiling. Existing environment/credential files are not rewritten. Do not replace privacy defaults with `dataCollection: {}` unless intentionally opting into collection.

Node stays **26.12.1**, ABI 147, in local and all Node Docker stages. Homebrew reports Brotli **1.2.1**; official Docker Node reports **1.2.0 with the security backport**, not an unfixed decoder. The [official release](https://nodejs.org/en/blog/release/v26.12.1) includes `a6040b50d9` (Brotli patch `0ed4268a4401abcb44720963`) and exposes `BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH=-17`; this was verified in the running image and is asserted in all three build stages. Upstream engine minima are 22.23.4 / 24.22.1 / 26.12.1. Native RE2, canvas and Sharp were exercised locally. Existing Storybook/TypeScript tooling peer warnings are not production runtime failures.

## PostgreSQL / Brotli

Original running database: PostgreSQL **18.6**, Alpine **3.24.3**, `brotli-libs-1.2.0-r1`, official image digest `sha256:898c60cb390d1085bc97bdd6a1ae968757421df394b071848b52b1c09c89d6a5`. Pulling official `18-alpine3.24` still returned that vulnerable image.

`docker/postgres.Dockerfile` derives from that exact maintained official PostgreSQL 18.6 image and installs **`brotli-libs=1.2.1-r0`** from stable Alpine 3.24. Build and package assertion succeeded. Entrypoint, PostgreSQL major/minor, PGDATA layout and volume mappings are unchanged. All Alpine PostgreSQL compose references, including devcontainer/federation templates, use the derived image/build. The active ignored `docker-compose.yml` must receive the same local-only reference update; it is backed up, not replaced by the example.

The already-running web and recommendation containers have fixed Debian backports, respectively **1.1.0-2+deb13u1** and **1.0.9-2+deb12u1**. Their Dockerfiles explicitly install and assert those minimums so system Brotli is checked separately from Node.

Sources: [Alpine advisory](https://security.alpinelinux.org/vuln/CVE-2026-111497), [OSV Alpine ranges](https://osv.dev/vulnerability/ALPINE-CVE-2026-111497), [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-111497). Debian marks the above backports fixed; lower upstream version numbers alone do not imply vulnerability.

## Database validation

The live dump was restored successfully, with `--exit-on-error`, into a separate patched PostgreSQL container. Original migration count: **346**. All three pending upstream migrations applied transactionally: `AutoArchiveAnnouncements1783913268595`, `UserProfilePasswordComment1790477603333`, `FollowApprovalByAccountAge1791109435844`. A second pending check returned false. The timestamp ordering is valid despite the announcement migration's older timestamp; TypeORM identifies pending classes by name.

Changes add three nullable columns and correct a comment; no tables/columns/data are dropped by `up()`. Their `down()` methods are destructive to the new columns and were not run on live data. No existing migration was changed and no fork schema object was added. The generated same-version invariant matches official 2026.10.1: **429 sources**, SHA-256 `e82262b1efef76e42d7497931fa1470e22dbca3aed8acda148dfaac8ac0ea5d6`.

Test databases are disposable dedicated integration containers, never the live database. Restored-data application smoke tests use an internal Docker network without federation egress and a separate Redis instance, never live Redis/queues/files.

## Validation record

See the final verification/deployment addendum below for final command results. Earlier failures were corrected, not suppressed: missing workspace build outputs; moved shared utility imports; semantic auto-merge errors above. The preserved uncommitted thread width was already 760 while its test expected 640; the test now asserts the actual intended width and minimum-width invariant. Original frontend/backend typechecks passed before integration.


## Final verification

- `pnpm verify:integrity`, `pnpm verify:db-schema`, `pnpm verify:modules`, and `pnpm verify:repo`: passed (final combined gate repeated).
- `pnpm test:misutgaru-regressions`: passed, including normalized caching, prepared notes and paginator coverage.
- `pnpm test:full`: passed; backend 75 files / 932 passed / 2 skipped, frontend 39 files / 238 passed, Mün animation 116 tests, plus SDK, core and private tooling suites.
- `pnpm build:app`: passed, including locale bundles and assets. Backend and frontend typechecks passed. SDK generated types/build passed.
- Targeted signature/ZIP/Sentry/following/API unit tests: 44 passed. Additional fork integration-contract tests: 3 passed.
- Isolated real-database e2e: 169 passed across API visibility, follower/following visibility, account-age follow approval and WebSocket streaming (four suites).
- Frozen lockfile validation and SPDX check: passed. Only upstream CHANGELOG whitespace remains in `git diff --check`; no conflict markers remain in the final tree.
- Production web, recommendation and patched PostgreSQL Docker builds passed. Restored-database production web container became healthy. HTTP home and API smoke checks passed; Chrome rendered the custom public timeline and opened the login UI without page errors. Earlier browser scripts used English button names against a Korean server and timed out; these were selector issues, not application crashes. This is smoke coverage, not exhaustive visual or federated multi-server certification.
- No existing applied migration was edited; restored migration count advanced from 346 to 349. Live deployment results are recorded below after deployment.
