# Delta from vanilla Misskey

Compared against the supplied `misskey-develop` snapshot from the same working session.

## High-level difference

Misutgaru preserves Misskey federation and data-model foundations but substantially changes frontend rendering and several backend hot paths.

The source comparison at that checkpoint found 301 files added, 5 deleted, and 485 modified, with 2647 matching files.

## Major deltas

| Area | Vanilla Misskey | Misutgaru |
| --- | --- | --- |
| Frontend | Vue SFC centered | hybrid Vue/Vune tree with 233 `.vune` files at checkpoint |
| Rendering boundary | Vue components | Vune hosts plus native Vune primitives for migrated subtrees |
| Motion | Vue transition/CSS/local animation | shared o0o0o-backed motion adapter for migrated UI |
| Translucency | component/local CSS | shared Material tiers and accessibility fallbacks |
| Note opening | route/detail flows | additional resizable thread-window flow |
| Translation | primarily DeepL path | OpenAI-compatible translation first when configured, DeepL fallback, bounded thread/image context |
| Web Push | upstream subscription flow | VAPID rotation, subscription-change repair, multi-account fixes, iOS installed-PWA handling |
| Runtime | separate application-role paths | optional combined RuntimeModule/single-process graph |
| Queue Redis | more role/queue connections | producer and worker connection sharing where safe |
| Entity packing | many per-entity fetch patterns | additional batch lookup and map redistribution |
| Cache | ordinary miss/fill behavior | in-flight miss coalescing and stale-fill protection |
| File output | ordinary stream writes | shared block sizing and buffered/vector writes |
| Stats | continuous sampling paths | demand-sensitive sampling for streaming consumers |

## What has not been replaced

There were no new database migrations in the compared fork snapshot. The project is therefore not a new social-server protocol or a new persistence model. It is a heavily modified Misskey implementation with a different UI migration/runtime direction.