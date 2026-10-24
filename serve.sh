#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Mün lives in packages/modules/Mun as its own git checkout (not tracked here).
if [[ ! -d packages/modules/Mun/packages/core ]]; then
	echo "serve.sh: Mün checkout missing at packages/modules/Mun (clone https://github.com/kyooni18/Mun.git there)" >&2
	exit 1
fi

# The compose file uses a pre-built image for web, so build it explicitly.
# The frontend bundle is generated inside the image; do not let BuildKit reuse
# a stale COPY/build layer when serving the current working tree.
docker build --no-cache --tag kyooni18/misutgaru-web:latest .

# Rebuild the recommendation service as well so changes under
# packages/recommendation are always reflected by ./serve.sh.
docker compose build --no-cache recommendation

# Intentionally omit --volumes: db/ and redis/ are bind mounts and must survive
# the compose restart.
docker compose down --remove-orphans
docker compose up -d
docker system prune -a --force
