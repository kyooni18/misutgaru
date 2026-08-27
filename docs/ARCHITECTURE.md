# Architecture

## Frontend

Misutgaru is currently a hybrid Vue and Vune frontend.

A typical migrated path is:

`Vue application/state → compatibility or placement host → Vune compiled view → Vune web renderer`

Important boundaries live under `packages/frontend/src/vune`:

| File | Responsibility |
| --- | --- |
| `native.ts` | native Vune web primitives and low-level browser semantics |
| `compat-vue.ts` | placement bridge used while Vue still owns surrounding lifecycle/state |
| `vue.ts` | older Vue compatibility layer; migration debt, avoid expanding it |
| `motion.ts` | shared motion adapter and animation ownership |

Vite uses the Vune plugin before Vue compilation and the Vune pipeline uses Oxc for TypeScript transformation.

## Motion and Material

The fork introduces a shared animation path so opacity, transform, size, color, and other animated properties can keep independent timing while composing on the same element. Migrated surfaces should use the common Material tiers instead of introducing one-off backdrop-filter rules.

## Backend runtime

The backend adds a combined runtime path centered on a shared Nest graph. `singleProcessMode` can run server and queue roles in one application graph while explicit split-role and clustered deployments must remain supported.

Optimization work includes:

- shared Redis/BullMQ connections where sharing is safe;
- CPU-aware concurrency and HTTP pool defaults;
- cache miss coalescing and invalidation ordering;
- batched entity packing and role/badge lookup;
- buffered and vectorized file writes with common block sizes;
- lazy server and queue statistics when no stream consumer is present.

## Fork-specific features

Thread windows open detailed note conversations in a resizable window rather than requiring only route navigation.

Translation can use an OpenAI-compatible provider before DeepL fallback, include bounded previous-thread context, and attach a limited set of downscaled images for image text translation or description.

Web Push includes VAPID-key rotation handling, `pushsubscriptionchange`, multi-account registration repair, and iOS installed-PWA checks.