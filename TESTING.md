# Rental booking API tests

The four cases call the local application API and verify PostgreSQL records. The runner creates a disposable local PostgreSQL 16 container, initializes its schema, starts the local server, runs the cases, and removes the container. It uses mock wallet credit only; no real-money payment is called.

## Setup and execution

1. Install Node.js dependencies with `npm ci` in this checkout.
2. Start Docker Desktop and wait until its engine is running.
3. Run `powershell -NoProfile -File scripts/run-rental-tests.ps1` from this folder. Ports 3000 and 55432 must be free. The first run may download the official `postgres:16-alpine` image.
4. Copy the test output and results into `TEST_REPORT.md` for the submission. Do not copy credentials or tokens.

No Supabase URL, API key, database password, or `.env` file is needed for this local run. The script generates a temporary password and JWT secret in memory. It refuses to run if Docker is unavailable or the ports are occupied. The test file also refuses non-local database URLs, even when launched manually.

The project `finaly` is used by the deployed Render website. **Do not run this suite, `database/schema.sql`, or `npm run seed` against `finaly`.** The schema script drops tables; it is used here only inside a fresh, disposable local container. An interrupted run may leave a container named `pj1-rental-test-*`; inspect it before removing it.

These are application integration tests against the same PostgreSQL engine used by Supabase, but not a live Supabase-hosted test. To verify the hosted environment separately, obtain a genuinely isolated Supabase project and a safe migration plan first.
