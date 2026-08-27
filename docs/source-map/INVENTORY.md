# Source inventory

This exhaustive table is generated from the checkout by `scripts/generate-source-inventory.mjs` and should be refreshed after source files are added, moved, or deleted.

Run:

```sh
node scripts/generate-source-inventory.mjs
```

To classify each file against an upstream Misskey checkout:

```sh
node scripts/generate-source-inventory.mjs --upstream /path/to/misskey
```

The generated table contains one row per indexed source/config file with path, area, delta classification, and purpose. The human-oriented map is `docs/SOURCE_MAP.md`.