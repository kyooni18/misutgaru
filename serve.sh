#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Mün lives in packages/modules/Mun as its own git checkout (not tracked here).
if [[ ! -d packages/modules/Mun/packages/core ]]; then
	echo "serve.sh: Mün checkout missing at packages/modules/Mun (clone https://github.com/kyooni18/Mun.git there)" >&2
	exit 1
fi

# Ask Compose which services are enabled so profiles from COMPOSE_PROFILES or
# .env also control whether the experimental recommendation image is built.
enabled_services="$(docker compose config --services)"
build_services=(web)
while IFS= read -r service; do
	if [[ "$service" == recommendation ]]; then
		build_services+=(recommendation)
	fi
done <<< "$enabled_services"

# Build the exact image tags used by Compose. The frontend bundle is generated
# inside the image; do not reuse a stale COPY/build layer.
docker compose build --no-cache "${build_services[@]}"

# Intentionally omit --volumes: db/ and redis/ are bind mounts and must survive
# the compose restart.
docker compose down --remove-orphans
docker compose up -d
docker system prune -a --force
