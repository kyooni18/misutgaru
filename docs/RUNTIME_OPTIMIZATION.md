# Runtime optimization

The fork optimizes runtime ownership rather than changing the Misskey data model.

## Combined application graph

`singleProcessMode` can place server and queue roles in one Nest application graph so core services, repositories, DB pools, and Redis clients are not duplicated unnecessarily. Split-role and clustered deployment paths must continue to work.

## Redis and BullMQ

Producer queues share a dedicated Redis connection where BullMQ semantics allow it. Worker-side command connections are also shared where safe, while subscriber-style connections remain separate when required.

## Concurrency and HTTP pools

Queue concurrency and HTTP socket defaults can be derived from available CPU count instead of relying only on fixed defaults, while explicit configuration remains authoritative.

## Entity packing

Hot entity packers collect IDs first, fetch users/files/channels/polls/reactions/roles and related data in batches, then redistribute results through maps. Avoid regressions that restore one query per entity.

## Cache

Concurrent misses for the same key can share one in-flight promise. Invalidation ordering prevents a stale fetch that started earlier from repopulating a key after a newer invalidation.

## Block I/O

The fork centralizes block sizes for sequential reads, writes, and hash-like workloads. `FileWriterStream` and `BufferedTextFileWriter` reduce syscall count by batching small fragments and using vector writes where appropriate.

## Statistics

Server and queue statistics should avoid continuous expensive sampling when there are no streaming consumers.

Benchmark or test ownership, shutdown, query count, and output correctness when touching these paths; simpler code that recreates per-item queries or per-queue connections is a regression.