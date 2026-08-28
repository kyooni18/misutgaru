# Misutgaru developer documentation

Current engineering references:

| Document | Purpose |
| --- | --- |
| [CURRENT_STATE.md](CURRENT_STATE.md) | current source checkpoint, metrics and validation boundary |
| [../ROADMAP.md](../ROADMAP.md) | remaining engineering priorities after the 2026-08-28 pass |
| [ARCHITECTURE.md](ARCHITECTURE.md) | compiler/renderer/backend ownership and data flow |
| [DB_COMPATIBILITY.md](DB_COMPATIBILITY.md) | hard PostgreSQL compatibility invariant and verification |
| [VUNE.md](VUNE.md) | native/compat boundary, typed host bridge, renderer and DevTools rules |
| [RUNTIME_OPTIMIZATION.md](RUNTIME_OPTIMIZATION.md) | cache consistency, batching, runtime and I/O behavior |
| [VANILLA_DELTA.md](VANILLA_DELTA.md) | conceptual fork delta from vanilla Misskey |
| [UPSTREAM_DELTA.md](UPSTREAM_DELTA.md) | generated current whole-tree upstream delta |
| [SOURCE_MAP.md](SOURCE_MAP.md) | human-oriented implementation map |
| [source-map/INVENTORY.md](source-map/INVENTORY.md) | exhaustive source/config path table |
| [IMPROVEMENTS-2026-08-28.md](IMPROVEMENTS-2026-08-28.md) | first stabilization/compiler/runtime improvement pass |
| [IMPROVEMENTS-ROUND3-2026-08-28.md](IMPROVEMENTS-ROUND3-2026-08-28.md) | DB-locked virtualization, batching, diagnostics and resilience pass |
| [VERIFICATION-2026-08-28.md](VERIFICATION-2026-08-28.md) | what was and was not executable in the artifact workspace |
| [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md) | Web Push lifecycle and recovery behavior |

Phase journals under `archive/2026-08-migration` are historical snapshots. Do not use their counts as current state.

When documentation and source disagree, prefer current source/package manifests, then executable checks, then `CURRENT_STATE.md`, then topic docs.

Useful refresh commands:

```sh
pnpm vune:report
node scripts/generate-source-inventory.mjs --upstream /path/to/misskey
pnpm upstream:delta -- --upstream /path/to/misskey --write docs/UPSTREAM_DELTA.md
```
