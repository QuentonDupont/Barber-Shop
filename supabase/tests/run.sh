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
# Everything that isn't the shim (already applied above) or the seed-
# dependent 3x bucket (below) builds its own fixtures and expects an
# otherwise-empty database — 10x, 20x, 25x, 40x, and anything added later.
#
# This is an exclude list, not an allow list, on purpose: an earlier version
# used `[12]*.sql` here, which silently skipped `40_multi_staff.sql` (QA
# report #4 §3) because its prefix wasn't in the allow-listed set of digits.
# Excluding only the two things that are genuinely special (the shim, and
# "needs seed.sql first") means a brand new file — 50x, 60x, whatever comes
# next — runs automatically instead of needing this script edited again.
for file in "$ROOT"/supabase/tests/*.sql; do
  base="$(basename "$file")"
  case "$base" in
    00_supabase_shim.sql|3*.sql) continue ;;
  esac
  run_assertions "$file"
done

echo "Applying the seed…"
if ! "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql" > "$DB.log" 2>&1; then
  failures=1
  cat "$DB.log"
fi
grep -E "ERROR|Seeded" "$DB.log" | sed 's/^psql:[^ ]*[0-9]: //;s/^NOTICE:  //'

# 3x checks the seed's output alongside the earlier fixtures — the only
# bucket that depends on seed.sql having run. Anything that doesn't need the
# seed belongs in the loop above, not here.
for file in "$ROOT"/supabase/tests/3*.sql; do run_assertions "$file"; done
rm -f "$DB.log"

if [ "$failures" -ne 0 ]; then
  echo "FAILED"
  exit 1
fi
echo "All database assertions passed."
