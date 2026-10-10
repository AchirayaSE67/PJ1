# Rental booking test execution report

- Updated: 2026-10-10 (Asia/Bangkok)
- Test branch: `test-rent-pc` in `AchirayaSE67/PJ1`, based on `main`
- Source commit: `075071bb91b6077a3166bd18372db7bb5f53356d`
- Suite: `tests/rental-booking.db.test.js`
- Result: **Pending local PostgreSQL execution; Docker Desktop engine is not running**

## Environment decision

The junior confirmed the deployed Render website uses Supabase project `finaly`. The earlier assumption that it was isolated was incorrect. No database-changing tests were run against it, and its supplied credentials were not used. The runner now uses a fresh, disposable local PostgreSQL container and the test file rejects non-local database URLs. On 2026-10-10, a deliberate non-local URL check failed before any connection or write, as intended. JavaScript syntax, PowerShell parsing, and `git diff --check` passed. Docker CLI is installed, but its engine is not running, so the four integration cases have not been executed.

## Cases

| Case | Expected result | Status |
| --- | --- | --- |
| TC-01 Successful create/read | HTTP 201, linked records, exact mock-wallet debit | NOT RUN |
| TC-02 Insufficient balance | HTTP 400, no writes | NOT RUN |
| TC-03 Maintenance computer | HTTP 400, no writes | NOT RUN |
| TC-04 Missing computer ID | HTTP 400, no writes | NOT RUN |

Start Docker Desktop, run `powershell -NoProfile -File scripts/run-rental-tests.ps1`, then replace the pending status with actual output. A local pass does not establish that the hosted Supabase project has the same schema or behavior.
