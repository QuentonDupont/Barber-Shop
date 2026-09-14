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

run_assertions() {
  local file="$1"
  # The FAIL line is raised as an exception, so psql exits non-zero on it.
  if ! "${PSQL[@]}" -d "$DB" -f "$file" > "$DB.log" 2>&1; then
    failures=1
  fi
  grep -E "PASS|FAIL|ERROR" "$DB.log" | sed 's/^psql:[^ ]*[0-9]: //;s/^NOTICE:  //'
}

echo "Running assertions…"
failures=0
# 1x and 2x build their own fixtures and expect an otherwise empty database.
for file in "$ROOT"/supabase/tests/[12]*.sql; do run_assertions "$file"; done

echo "Applying the seed…"
if ! "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql" > "$DB.log" 2>&1; then
  failures=1
  cat "$DB.log"
fi
grep -E "ERROR|Seeded" "$DB.log" | sed 's/^psql:[^ ]*[0-9]: //;s/^NOTICE:  //'

# 3x checks the seed's output alongside the earlier fixtures.
for file in "$ROOT"/supabase/tests/3*.sql; do run_assertions "$file"; done
rm -f "$DB.log"

if [ "$failures" -ne 0 ]; then
  echo "FAILED"
  exit 1
fi
echo "All database assertions passed."
