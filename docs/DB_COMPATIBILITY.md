# PostgreSQL compatibility invariant

Misutgaru uses the PostgreSQL schema of the matching vanilla Misskey version without fork-only changes. A database initialized and migrated by that vanilla version must remain usable by Misutgaru, and switching back to the same vanilla version must not require a repair migration or schema rollback.

## What is locked

`pnpm verify:db-schema` checks `scripts/db-schema-invariant.json`, generated from vanilla Misskey, against the current tree. The fingerprint covers:

- every file under `packages/backend/migration/**`;
- every top-level TypeORM entity model under `packages/backend/src/models/*.ts`;
- schema-shaping helpers under `packages/backend/src/models/util/**`, including the shared ID column definition;
- any backend TypeScript source that contains TypeORM schema decorators, even if a future file is placed outside the historical models directory;
- the exported TypeORM entity registry in `packages/backend/src/postgres.ts`;
- the DataSource `entities` and `migrations` schema options.

The whole `postgres.ts` file is intentionally not byte-locked. Misutgaru can optimize non-schema runtime settings such as query caching or connection behavior as long as the entity registry and migration configuration remain identical.

When a matching vanilla checkout is available, run:

```sh
node scripts/check-db-schema-invariant.mjs --against-upstream --upstream /path/to/misskey
```

The scheduled upstream compatibility workflow always verifies the pinned same-version manifest. It compares directly against live `develop` only while live upstream reports the same package version; once upstream advances to another version, the workflow reports source/merge drift without incorrectly treating a legitimate new vanilla migration as a Misutgaru DB violation.

## Forbidden fork changes

Misutgaru must not add or change PostgreSQL tables, columns, indexes, enums, constraints, triggers, functions, entity decorators, or migrations. Existing vanilla migrations must not be edited or reordered.

A fork feature that needs additional state must be redesigned to use, in order of preference, an existing vanilla Misskey representation, Redis with bounded lifetime where appropriate, process-local memory for ephemeral diagnostics, browser/client storage for client-owned state, configuration, or an explicitly external persistence service.

Redis and process-local state are not part of the PostgreSQL compatibility contract and must fail or expire without requiring database repair.

## Release expectation

Source fingerprinting is the fast gate and runs before dependency-backed tests. A fully populated release checkout should additionally run `pnpm verify:full`. If a deployment test harness is available, the strongest smoke test is vanilla migration, Misutgaru startup and normal writes, then startup of the same vanilla version against the unchanged database.
