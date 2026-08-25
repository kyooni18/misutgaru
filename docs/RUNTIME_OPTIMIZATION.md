# Runtime optimization

Misutgaru uses the optimized runtime as its normal execution path. There is no separate lightweight profile.

The default runtime now:

- runs HTTP and queue processing in one Nest application graph (`singleProcessMode: true`), so the normal process shares the database pool, Redis clients, repositories, caches, and core services;
- shares compatible non-subscriber application Redis clients and uses one dedicated BullMQ producer connection across all queues;
- keeps the dedicated Redis subscriber connection separate, because Redis subscriber mode cannot safely share normal commands;
- shares one BullMQ worker command connection configured for long-lived workers while leaving each worker/event stream's required blocking connection dedicated;
- bounds generic in-process key/value caches with LRU eviction instead of allowing them to grow without a ceiling;
- creates queue/server statistics samplers only while a streaming stats channel is actually being watched;
- lazily imports optional system-information code only when server metrics are requested;
- scales queue concurrency and outgoing HTTP socket defaults from the available CPU count while preserving explicit configuration overrides;
- closes owned Nest application contexts on SIGTERM/SIGINT so queue workers, HTTP/WebSocket services, database pools, Redis clients, and caches receive their normal shutdown hooks.

## Block I/O

Server file I/O uses shared sequential buffer sizes from `packages/backend/src/misc/block-io.ts`:

- sequential reads: 128 KiB;
- sequential writes: 256 KiB;
- hash/image inspection: 512 KiB.

Hot request/job paths no longer use synchronous mkdir/copy/write/delete operations in the internal file store or custom-emoji import/export path. Internal original, thumbnail, and web-public writes are submitted independently instead of being serialized when they do not depend on one another. File inspection also reuses already-known stat data instead of issuing redundant filesystem metadata calls.

`FileWriterStream` batches small chunks until the write threshold and flushes them through `FileHandle.writev()`, including correct handling of partial vector writes and the platform iovec limit. `BufferedTextFileWriter` puts JSON/CSV exporters on that path, so awaiting every logical line or fragment no longer means one filesystem write per fragment. Writers are explicitly closed before their temporary files are handed to Drive storage.

Large archive streams remain regular Node streams, but use the same write high-water mark. File serving, ranged/proxy reads, Drive upload reads, download writes, MIME/SVG header inspection, and hashing use the shared buffered policy rather than unrelated defaults.

Synchronous filesystem calls that remain in backend source are startup/configuration operations such as finding the repository root, loading generated config, managing a PID file, and creating a Unix-domain socket. They are intentionally outside request and queue hot paths.

If `clusterLimit` is explicitly greater than 1, the existing multi-process path is selected automatically unless `singleProcessMode` is set explicitly. For other scale-out layouts, set `singleProcessMode: false` or run the server/queue roles separately. Existing per-queue concurrency, rate-limit, HTTP pool, Redis split, cluster, and thread-pool settings continue to override defaults.
