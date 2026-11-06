#!/bin/sh
# Makes sure the data directory is writable, then runs the app as an unprivileged user.
# PUID / PGID choose that user (default 1000:1000, the image's "node" user), which is
# handy when bind-mounting host folders owned by another account.
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
DATA_DIR="${DATA_DIR:-/data}"
IMPORT_DIR="${IMPORT_DIR:-$DATA_DIR/import}"

if [ "$(id -u)" = "0" ]; then
	mkdir -p "$DATA_DIR" "$IMPORT_DIR"
	for dir in "$DATA_DIR" "$IMPORT_DIR"; do
		# Only walk the tree when ownership is wrong, so restarts stay fast on large libraries.
		if [ "$(stat -c %u "$dir")" != "$PUID" ] || [ "$(stat -c %g "$dir")" != "$PGID" ]; then
			echo "[gallery] Setting ownership of $dir to $PUID:$PGID"
			chown -R "$PUID:$PGID" "$dir"
		fi
	done
	exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups -- "$@"
fi

exec "$@"
