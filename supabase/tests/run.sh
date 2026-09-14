#!/usr/bin/env bash
#
# Applies every migration to a throwaway database and asserts the invariants
# that RLS and the booking constraints are supposed to guarantee.
#
# Needs a PostgreSQL server with `btree_gist` and `pgcrypto` available. Point it
# at any instance with PG* environment variables, or let it start a local one:
#
#   ./supabase/tests/run.sh                     # against $PGHOST/$PGPORT
#   PGHOST=localhost PGPORT=54322 ./run.sh      # against `supabase start`
#
set -euo pipefail

DB="${BOOKLY_TEST_DB:-bookly_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Rebuilding $DB…"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB};" -c "create database ${DB};"

echo "Applying the Supabase shim (auth schema, roles, auth.uid)…"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/00_supabase_shim.sql"

echo "Applying migrations…"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$file")"
  "${PSQL[@]}" -d "$DB" -f "$file" 2>&1 | grep -v "does not exist, skipping" || true
done

echo "Running assertions…"
failures=0
for file in "$ROOT"/supabase/tests/[12]*.sql; do
  if ! "${PSQL[@]}" -d "$DB" -f "$file" 2>&1 \
      | grep -E "PASS|FAIL|ERROR" \
      | sed 's/^psql:[^ ]*[0-9]: //;s/^NOTICE:  //'; then
    failures=1
  fi
done

if [ "$failures" -ne 0 ]; then
  echo "FAILED"
  exit 1
fi
echo "All database assertions passed."
