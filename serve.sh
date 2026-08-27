#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Build the local linked modules before the frontend image so Docker receives
# the current Vune distribution and o0o0o WASM kernels.
pnpm --dir packages/modules/o0o0o run build:wasm
ln -sfn "$(pwd)/packages/modules/o0o0o" packages/modules/Vune/packages/web/node_modules/o0o0o
pnpm --dir packages/modules/Vune run build

# The compose file uses a pre-built image for web, so build it explicitly.
# The frontend bundle is generated inside the image; do not let BuildKit reuse
# a stale COPY/build layer when serving the current working tree.
docker build --no-cache --tag kyooni18/misutgaru-web:latest .

# Intentionally omit --volumes: db/ and redis/ are bind mounts and must survive
# the compose restart.
docker compose down --remove-orphans
docker compose up -d
