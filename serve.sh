#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Build the nested Vune workspace, including @vune-ui/animation and its WASM
# kernels, before the frontend image is assembled.
pnpm modules:build

# The compose file uses a pre-built image for web, so build it explicitly.
# The frontend bundle is generated inside the image; do not let BuildKit reuse
# a stale COPY/build layer when serving the current working tree.
docker build --no-cache --tag kyooni18/misutgaru-web:latest .

# Intentionally omit --volumes: db/ and redis/ are bind mounts and must survive
# the compose restart.
docker compose down --remove-orphans
docker compose up -d
docker system prune -a --force
