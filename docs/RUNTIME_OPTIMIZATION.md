# Runtime optimization

Misutgaru uses the optimized runtime as its normal execution path. There is no separate lightweight profile.

The default runtime shares compatible Redis clients, runs HTTP and queue processors in one Nest graph unless explicitly split, bounds in-process caches, lazy-loads optional heavy dependencies, dispatches Redis events through a single typed hub, and starts administrative samplers only while they are observed. Queue/database/socket defaults scale conservatively with available CPU and remain individually configurable.

For explicit scale-out, disable `singleProcessMode` or run the server/queue roles separately and raise the individual concurrency/pool settings as required.
