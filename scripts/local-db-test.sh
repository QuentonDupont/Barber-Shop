# Runs the database tests (npm run db:test) on a throwaway local PostgreSQL 17,
# so every change is checked before it is pushed. No Docker, no root, no system Postgres.
#
#   bash scripts/local-db-test.sh              # the full database test suite
#   bash scripts/local-db-test.sh psql -d tatnat_test -c "select 1"   # any command against the same server
#
# First run downloads prebuilt PostgreSQL binaries (about 40 MB) from the
# theseus-rs/postgresql-binaries GitHub releases into $PG_HOME (needs network for
# that one step; later runs are offline). Everything else lives under $TMPDIR and
# is stopped and removed on exit.
#
# Environment (all optional):
#   PG_HOME   where the binaries live   (default: ../_pg next to this repo)
#   PG_VER    release to fetch          (default: 17.1.1)
#   PG_PORT   local TCP port            (default: 54399)
# Notes for sandboxed shells: Unix sockets can be forbidden, so this uses TCP on
# 127.0.0.1 only; `tar` can fail with "Function not implemented", so the archive is
# unpacked with Python's tarfile.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_HOME="${PG_HOME:-$ROOT/../_pg}"
PG_VER="${PG_VER:-17.1.1}"
PG_PORT="${PG_PORT:-54399}"
NAME="postgresql-${PG_VER}-x86_64-unknown-linux-gnu"
BIN="$PG_HOME/$NAME/bin"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/tatnat-pg.XXXXXX")"

mkdir -p "$PG_HOME"
if [ ! -x "$BIN/postgres" ]; then
  echo "Fetching PostgreSQL $PG_VER binaries..."
  curl -fsSL -o "$PG_HOME/pg.tar.gz" \
    "https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG_VER}/${NAME}.tar.gz"
  python3 -I -c "import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2], filter='data')" \
    "$PG_HOME/pg.tar.gz" "$PG_HOME"
fi

cleanup() { "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$BIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 >/dev/null
"$BIN/pg_ctl" -D "$WORK/data" -w -l "$WORK/server.log" \
  -o "-p $PG_PORT -c unix_socket_directories= -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off" start >/dev/null

export PATH="$BIN:$PATH"
export PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGUSER=postgres
cd "$ROOT"
if [ "$#" -gt 0 ]; then "$@"; else npm run db:test; fi
