#!/usr/bin/env bash
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres ./run-tests.sh   (needs Postgres with PostGIS; creates a scratch database)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=gochits_test_$$
createdb "$DB"; trap 'dropdb --if-exists "$DB"' EXIT
export PGDATABASE=$DB
psql -v ON_ERROR_STOP=1 -q -f tests/00_stub_supabase.sql
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -f seed.sql
for f in tests/1*.sql; do psql -v ON_ERROR_STOP=1 -q -f "$f"; done
