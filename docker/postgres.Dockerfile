# PostgreSQL 18.6 / Alpine 3.24, pinned multi-platform official image.
# The official image still ships Brotli 1.2.0-r1 (CVE-2026-111497).
FROM postgres:18.6-alpine3.24@sha256:898c60cb390d1085bc97bdd6a1ae968757421df394b071848b52b1c09c89d6a5

# Fail the build rather than silently shipping an unfixed package. No edge
# repository, PostgreSQL major-version change, entrypoint or PGDATA change.
RUN apk add --no-cache --upgrade brotli-libs=1.2.1-r0 \
	&& apk list --installed brotli-libs 2>/dev/null | grep -q '^brotli-libs-1.2.1-r0 '
