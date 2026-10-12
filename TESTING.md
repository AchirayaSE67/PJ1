# Rental booking automated tests

The project has four Node.js API/database integration cases and four Python Playwright browser cases. The UI suite checks the real booking pages and visible outcomes in Chromium. The runner creates a disposable local PostgreSQL 16 container, initializes its schema, starts the local server, runs both suites, and removes the container. It uses mock wallet credit only; no real-money payment is called.

## Setup and execution

1. Install Node.js dependencies with `npm ci` in this checkout.
2. Install browser test dependencies with `python -m pip install -r requirements-test.txt`.
3. Install Chromium once with `python -m playwright install chromium`.
4. Start Docker Desktop and wait until its engine is running.
5. Run `powershell -NoProfile -File scripts/run-rental-tests.ps1` from this folder. Ports 3000 and 55432 must be free. The first run may download the official `postgres:16-alpine` image.
6. The runner records one 1280x720 Playwright video per UI case under `test-results/videos/<run timestamp>/`, using filenames `UI-01-*.webm` through `UI-04-*.webm`. It also creates `video-manifest.json` in that folder.
7. Record the test output and video links in the submission sheet. Do not copy credentials or tokens.

## Submission links

- Thai test-case sheet: https://docs.google.com/spreadsheets/d/1hgbC4VGbdiqOzfaoWg3mdwNEV3ZFbDzfV1Easa-nGTA/edit
- Video evidence folder: https://drive.google.com/drive/folders/1y7S-wy22CktGN-TUO12uVjVyGnj3c1cB
- Upstream pull request: https://github.com/thanathiwong-svg/PJ1/pull/2

No Supabase URL, API key, database password, or `.env` file is needed for this local run. The script generates a temporary password and JWT secret in memory and clears email-provider settings while the test server runs. It refuses to run if Docker is unavailable or the ports are occupied. Both test suites refuse non-local database URLs, even when launched manually.

The project `finaly` is used by the deployed Render website. **Do not run this suite, `database/schema.sql`, or `npm run seed` against `finaly`.** The schema script drops tables; it is used here only inside a fresh, disposable local container. An interrupted run may leave a container named `pj1-rental-test-*`; inspect it before removing it.

These are application integration tests against the same PostgreSQL engine used by Supabase, but not a live Supabase-hosted test. To verify the hosted environment separately, obtain a genuinely isolated Supabase project and a safe migration plan first.
