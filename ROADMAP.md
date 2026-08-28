# Misutgaru roadmap

The 2026-08-28 stabilization and runtime passes now cover DB-compatibility enforcement, dynamic-height timeline virtualization, request-scoped backend batching, cross-process cache invalidation, process-local runtime diagnostics, Vune typed host generation, boundary-local invalidation, transition/presentation coordination, DevTools inspection and deterministic motion regression. This file lists the work that still remains.

## 1. Run the dependency-backed release gate

- run `pnpm verify:full` in a normal networked checkout;
- fix any frontend/backend type errors revealed by the complete dependency graph;
- run the complete Vitest and Playwright application suites with PostgreSQL and Redis services;
- build the production Docker image from a clean recursive-submodule checkout;
- keep `pnpm verify:db-schema` required so a Misutgaru-only PostgreSQL change cannot merge.

## 2. Measure the new timeline path on real datasets

- exercise mixed text/media/poll timelines with hundreds and thousands of loaded notes;
- validate scroll anchoring on image load, content expansion, prepend, pagination and deletion;
- tune the 72-row virtualization threshold, overscan and 240-item streaming identity window from captured traces rather than synthetic timing alone;
- add stable fixtures for thread-window, emoji-picker, modal, notification and deck scenarios.

## 3. Continue native Vune subtree migration

- remove Vue placement hosts only when complete parent/child subtrees have native equivalents;
- reduce `VueComponent` and `VueSlot` compatibility use without inflating native counts;
- move missing browser semantics into Vune primitives instead of creating raw host escapes;
- preserve focus, presentation, accessibility and lifecycle parity before changing ownership.

Migration order remains an engineering decision. `pnpm vune:report` reports facts and does not maintain an automatic priority score.

## 4. Finish state-preserving Vune HMR

Current hot updates invalidate only the changed compiler source cache and reuse Vite's normal module graph. They do not yet promise State preservation across component implementation replacement.

- define stable View/type and State-slot identity across hot replacement;
- invalidate only affected compiled bindings and dependent Views;
- fall back to a safe remount when structural compatibility cannot be proven;
- test PostForm-like stateful surfaces before calling the feature complete.

## 5. Expand production observability without PostgreSQL storage

- add DB-pool and queue/backlog sampling to the existing process-local diagnostics surface;
- keep event-loop delay, batch, cache and trace buffers bounded and disabled or cheap when unused;
- export trend data to an external observability target or Redis only when persistence is needed;
- use diagnostics to find real query/batch/cache regressions before adding more speculative optimization.

## 6. Reduce upstream merge cost

- record an exact upstream Git commit in `UPSTREAM_BASE.json` on the next real upstream sync;
- generate source and DB-invariant reports on every rebase;
- move fork-only code behind `@misutgaru/core` or another package only when doing so measurably reduces modified upstream-shaped files;
- keep same-version vanilla PostgreSQL compatibility as a hard invariant even when upstream `develop` advances to a later schema.

## 7. Harden deployment smoke coverage

- verify vanilla same-version DB -> Misutgaru -> vanilla same-version startup against a disposable PostgreSQL copy;
- test Redis disconnect/reconnect and invalidation-subscriber retry under multiple backend processes;
- verify the normalized frontend cache cannot cross account/session reload boundaries;
- keep deterministic work-count gates in CI and treat hardware-dependent timings as trends rather than brittle pass/fail thresholds.
