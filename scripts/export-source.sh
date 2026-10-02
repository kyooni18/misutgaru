#!/bin/sh
# Export the current working tree for review outside this Mac.
#
# Usage:
#   ./scripts/export-source.sh [path/to/output.tar.gz]

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ROOT_NAME=$(basename "$ROOT")
STAMP=$(date +%Y%m%d-%H%M%S)

usage() {
	printf '%s\n' "usage: $0 [path/to/output.tar.gz]"
	printf '%s\n' "       $0 --help"
}

if [ "$#" -gt 1 ]; then
	usage >&2
	exit 2
fi

if [ "$#" -eq 1 ]; then
	case "$1" in
		-h|--help) usage; exit 0 ;;
		/*) ARCHIVE=$1 ;;
		*) ARCHIVE=$(pwd)/$1 ;;
	esac
else
	ARCHIVE="$ROOT/exports/${ROOT_NAME}-source-${STAMP}.tar.gz"
fi

mkdir -p "$(dirname -- "$ARCHIVE")"
TEMP_ARCHIVE=$(mktemp "${TMPDIR:-/tmp}/misutgaru-source.XXXXXX")
trap 'rm -f "$TEMP_ARCHIVE"' EXIT HUP INT TERM

# Use the working tree rather than git archive so uncommitted changes in the
# main repository and both submodules are included.
tar -czf "$TEMP_ARCHIVE" \
	-C "$(dirname "$ROOT")" \
	--exclude='.git' \
	--exclude='node_modules' \
	--exclude='dist' \
	--exclude='built' \
	--exclude='build' \
	--exclude='coverage' \
	--exclude='.pi' \
	--exclude='.DS_Store' \
	--exclude='*.log' \
	--exclude='*.pem' \
	--exclude='*.key' \
	--exclude='docker.env' \
	--exclude="$ROOT_NAME/.config/default.yml" \
	--exclude="$ROOT_NAME/files" \
	--exclude="$ROOT_NAME/db" \
	--exclude="$ROOT_NAME/redis" \
	--exclude="$ROOT_NAME/exports" \
	--exclude='demo-dist' \
	--exclude='vue-demo-dist' \
	--exclude='web-demo-dist' \
	--exclude='parity-react-dist' \
	--exclude='parity-vue-dist' \
	--exclude='parity-web-dist' \
	--exclude='showcase-dist' \
	--exclude='local-packages/*.tgz' \
	--exclude='local-packages/manifest.json' \
	"$ROOT_NAME"

mv -f "$TEMP_ARCHIVE" "$ARCHIVE"
trap - EXIT HUP INT TERM

SIZE=$(du -h "$ARCHIVE" | awk '{print $1}')
printf 'Exported %s (%s)\n' "$ARCHIVE" "$SIZE"
printf 'Included: %s\n' "$ROOT_NAME"
printf '%s\n' 'Excluded: git metadata, dependencies, build output, runtime data, logs, keys, and local secrets.'
