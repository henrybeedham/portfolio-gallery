#!/usr/bin/env bash
#
# Imports everything from the previous gallery (github.com/henrybeedham/client-gallery) into
# this one, when both run in Docker on the same machine.
#
#   scripts/import-legacy.sh                 # interactive
#   scripts/import-legacy.sh --dry-run       # show what would be imported, change nothing
#   scripts/import-legacy.sh --old NAME --new NAME --yes
#
# How it works: a throwaway container is started from the NEW gallery's image with the OLD
# container's volumes mounted read-only and the new gallery's data volume mounted read-write.
# scripts/import-legacy.mjs runs inside it and asks the remaining questions. The old gallery's
# files are never written to; its database is copied to a temporary snapshot before reading.
# Running it again is safe: anything already imported is skipped.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
IMPORTER="$SCRIPT_DIR/import-legacy.mjs"

if [[ -t 1 ]]; then
	B=$'\e[1m' D=$'\e[2m' R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' X=$'\e[0m'
else
	B='' D='' R='' G='' Y='' X=''
fi

die() {
	echo "${R}Error:${X} $*" >&2
	exit 1
}

ask() { # question default -> answer
	local answer
	read -r -p "$1 ${D}[$2]${X} " answer || true
	echo "${answer:-$2}"
}

yes_no() { # question default(y|n)
	local answer
	while true; do
		answer=$(ask "$1 $([[ $2 == y ]] && echo '(Y/n)' || echo '(y/N)')" "$2")
		case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
			y | yes) return 0 ;;
			n | no) return 1 ;;
		esac
		echo "  Please answer y or n."
	done
}

usage() {
	sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
	exit 0
}

OLD=""
NEW=""
PASSTHROUGH=()
while (($#)); do
	case "$1" in
		--old) OLD=${2:?--old needs a container name}; shift 2 ;;
		--new) NEW=${2:?--new needs a container name}; shift 2 ;;
		-h | --help) usage ;;
		--dry-run | --yes | -y) PASSTHROUGH+=("$1"); shift ;;
		*) die "Unknown option: $1 (see --help)" ;;
	esac
done

[[ -f $IMPORTER ]] || die "Missing $IMPORTER — run this from a checkout of the new gallery."
command -v docker >/dev/null || die "docker is not installed or not on PATH."
docker info >/dev/null 2>&1 || die "Can't talk to Docker. Try running with sudo, or add your user to the 'docker' group."

echo
echo "${B}Import from the previous gallery${X}"
echo "${D}The old gallery's files are mounted read-only and are never changed.${X}"
echo

# ------------------------------------------------------------------ helpers

env_of() { docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1"; }
env_val() { env_of "$1" | sed -n "s/^$2=//p" | head -n 1; }
mounts_of() { docker inspect -f '{{range .Mounts}}{{println .Destination}}{{end}}' "$1"; }
state_of() { docker inspect -f '{{.State.Status}}' "$1"; }

# Is the path inside one of the container's mounts (rather than its throwaway filesystem)?
covered() {
	local path=$1 container=$2 dest
	while IFS= read -r dest; do
		[[ -n $dest ]] || continue
		if [[ $path == "$dest" || $path == "$dest"/* ]]; then return 0; fi
	done < <(mounts_of "$container")
	return 1
}

resolve() { # path workdir
	local p=$1
	[[ $p == /* ]] && { echo "$p"; return; }
	p=${p#./}
	echo "${2%/}/$p"
}

pick() { # role candidates...
	local role=$1
	shift
	local -a list=("$@")
	local answer
	if ((${#list[@]} == 1)); then
		if yes_no "Use ${B}${list[0]}${X} ($(state_of "${list[0]}")) as the ${role} gallery?" y; then
			echo "${list[0]}" >&3
			return
		fi
	elif ((${#list[@]} > 1)); then
		echo "Which container is the ${role} gallery?"
		local i=1
		for name in "${list[@]}"; do
			echo "  ${B}$i${X}) $name ${D}($(state_of "$name"))${X}"
			((i++))
		done
		answer=$(ask "Number or name" 1)
		if [[ $answer =~ ^[0-9]+$ ]] && ((answer >= 1 && answer <= ${#list[@]})); then
			echo "${list[answer - 1]}" >&3
			return
		fi
		echo "$answer" >&3
		return
	fi
	answer=$(ask "Name of the ${role} gallery container (see 'docker ps -a'):" "")
	echo "$answer" >&3
}

# ------------------------------------------------------- find the containers

OLD_CANDIDATES=()
NEW_CANDIDATES=()
while IFS= read -r name; do
	[[ -n $name ]] || continue
	envs=$(env_of "$name")
	entry=$(docker inspect -f '{{json .Config.Entrypoint}}' "$name")
	if grep -q '^DATABASE_PATH=' <<<"$envs" && grep -q '^UPLOAD_DIR=' <<<"$envs"; then
		OLD_CANDIDATES+=("$name")
	elif [[ $entry == *gallery-entrypoint* ]]; then
		NEW_CANDIDATES+=("$name")
	fi
done < <(docker ps -a --format '{{.Names}}')

if [[ -z $OLD ]]; then
	OLD=$( { pick old "${OLD_CANDIDATES[@]+"${OLD_CANDIDATES[@]}"}" 3>&1 1>&2; } )
fi
[[ -n $OLD ]] || die "No old gallery container chosen."
docker inspect "$OLD" >/dev/null 2>&1 || die "No container named '$OLD'."

if [[ -z $NEW ]]; then
	NEW=$( { pick new "${NEW_CANDIDATES[@]+"${NEW_CANDIDATES[@]}"}" 3>&1 1>&2; } )
fi
[[ -n $NEW ]] || die "No new gallery container chosen."
docker inspect "$NEW" >/dev/null 2>&1 || die "No container named '$NEW'."
[[ $OLD != "$NEW" ]] || die "The old and new containers must be different."

# ------------------------------------------------------------ old container

OLD_WORKDIR=$(docker inspect -f '{{.Config.WorkingDir}}' "$OLD")
OLD_WORKDIR=${OLD_WORKDIR:-/app}
LEGACY_DB=$(resolve "$(env_val "$OLD" DATABASE_PATH || true)" "$OLD_WORKDIR")
[[ $LEGACY_DB != "${OLD_WORKDIR%/}/" ]] || LEGACY_DB="${OLD_WORKDIR%/}/data/gallery.db"
OLD_UPLOADS_RAW=$(env_val "$OLD" UPLOAD_DIR || true)
LEGACY_UPLOADS=$(resolve "${OLD_UPLOADS_RAW:-./uploads}" "$OLD_WORKDIR")
# The old app always saved the hero image to ./uploads/hero relative to its working directory.
LEGACY_HERO_DIR="${OLD_WORKDIR%/}/uploads/hero"
LEGACY_TZ=$(env_val "$OLD" TZ || true)
LEGACY_TZ=${LEGACY_TZ:-UTC}

LEGACY_MOUNTS=()
TMP_COPY=""
cleanup() { [[ -z $TMP_COPY ]] || rm -rf "$TMP_COPY"; }
trap cleanup EXIT

if covered "$(dirname "$LEGACY_DB")" "$OLD" && covered "$LEGACY_UPLOADS" "$OLD"; then
	# Mount every volume of the old container, read-only.
	LEGACY_MOUNTS=(--volumes-from "$OLD:ro")
	if ! covered "$LEGACY_HERO_DIR" "$OLD"; then LEGACY_HERO_DIR="$LEGACY_UPLOADS/hero"; fi
else
	echo "${Y}The old container keeps its data inside the container rather than in a volume.${X}"
	echo "It will be copied out with 'docker cp' (read-only access) to a temporary folder first."
	yes_no "Continue?" y || exit 0
	TMP_COPY=$(mktemp -d "${TMPDIR:-/tmp}/legacy-gallery.XXXXXX")
	mkdir -p "$TMP_COPY/data" "$TMP_COPY/uploads"
	echo "${D}Copying data…${X}"
	docker cp -q "$OLD:$(dirname "$LEGACY_DB")/." "$TMP_COPY/data" || die "Could not copy the old database."
	docker cp -q "$OLD:$LEGACY_UPLOADS/." "$TMP_COPY/uploads" || die "Could not copy the old photos."
	if [[ $LEGACY_HERO_DIR != "$LEGACY_UPLOADS/hero" ]]; then
		mkdir -p "$TMP_COPY/hero"
		docker cp -q "$OLD:$LEGACY_HERO_DIR/." "$TMP_COPY/hero" 2>/dev/null || true
		LEGACY_MOUNTS+=(-v "$TMP_COPY/hero:/legacy/hero:ro")
		LEGACY_HERO_DIR=/legacy/hero
	else
		LEGACY_HERO_DIR=/legacy/uploads/hero
	fi
	LEGACY_MOUNTS+=(-v "$TMP_COPY/data:/legacy/data:ro" -v "$TMP_COPY/uploads:/legacy/uploads:ro")
	LEGACY_DB="/legacy/data/$(basename "$LEGACY_DB")"
	LEGACY_UPLOADS=/legacy/uploads
fi

# ------------------------------------------------------------ new container

NEW_IMAGE=$(docker inspect -f '{{.Image}}' "$NEW")
DATA_DIR=$(env_val "$NEW" DATA_DIR || true)
DATA_DIR=${DATA_DIR:-/data}
PUID=$(env_val "$NEW" PUID || true)
PGID=$(env_val "$NEW" PGID || true)
covered "$DATA_DIR" "$NEW" ||
	die "The new gallery's data directory ($DATA_DIR) isn't a volume, so imported photos would be lost. Mount a volume at $DATA_DIR (as docker-compose.yml does) and try again."

echo
echo "  Old gallery  ${B}$OLD${X} ${D}— $LEGACY_DB, $LEGACY_UPLOADS${X}"
echo "  New gallery  ${B}$NEW${X} ${D}— $DATA_DIR${X}"
echo

TTY_FLAGS=(-i)
[[ -t 0 && -t 1 ]] && TTY_FLAGS=(-it)

set +e
docker run --rm "${TTY_FLAGS[@]}" \
	--name "gallery-legacy-import-$$" \
	--network none \
	"${LEGACY_MOUNTS[@]}" \
	--volumes-from "$NEW" \
	-v "$IMPORTER:/app/import-legacy.mjs:ro" \
	-e DATA_DIR="$DATA_DIR" \
	-e PUID="${PUID:-1000}" \
	-e PGID="${PGID:-1000}" \
	-e LEGACY_DB="$LEGACY_DB" \
	-e LEGACY_UPLOADS="$LEGACY_UPLOADS" \
	-e LEGACY_HERO_DIR="$LEGACY_HERO_DIR" \
	-e LEGACY_TZ="$LEGACY_TZ" \
	-e IMPORT_WRAPPED=1 \
	"$NEW_IMAGE" \
	node --disable-warning=ExperimentalWarning /app/import-legacy.mjs "${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}"
STATUS=$?
set -e

# 0 = done, 2 = done with some failures, 130 = stopped part-way, 3 = nothing changed, 1 = error
case $STATUS in
	0 | 2 | 130)
		if [[ $(state_of "$NEW") == running ]]; then
			echo
			if yes_no "Restart ${B}$NEW${X} so imported settings take effect?" y; then
				docker restart "$NEW" >/dev/null && echo "${G}✓${X} Restarted $NEW."
			else
				echo "Imported albums are visible already; restart $NEW later to apply imported settings."
			fi
		fi
		;;
esac
exit "$STATUS"
