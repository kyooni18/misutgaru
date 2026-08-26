#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# The compose file uses a pre-built image for web, so build it explicitly.
docker build --tag kyooni18/misutgaru-web:latest .

# Intentionally omit --volumes: db/ and redis/ are bind mounts and must survive
# the compose restart.
docker compose down --remove-orphans
docker compose up -d
