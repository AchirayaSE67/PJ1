# Rental booking test execution report

- Updated: 2026-10-10 (Asia/Bangkok)
- Test branch: `test-rent-pc` in `AchirayaSE67/PJ1`, based on `main`
- Source commit: `075071bb91b6077a3166bd18372db7bb5f53356d`
- Suite: `tests/rental-booking.db.test.js`
- Execution date: 2026-10-10 (Asia/Bangkok)
- Command: `powershell -NoProfile -File scripts/run-rental-tests.ps1`
- Environment: local Node.js server and disposable `postgres:16-alpine` container
- Result: **PASS — 4/4 cases**

## Environment decision

The junior confirmed the deployed Render website uses Supabase project `finaly`. The earlier assumption that it was isolated was incorrect. No database-changing tests were run against it, and its supplied credentials were not used. The runner uses a fresh, disposable local PostgreSQL container and the test file rejects non-local database URLs. A deliberate non-local URL check failed before any connection or write, as intended. The local container was removed after the run.

## Cases

| Case | Expected result | Status |
| --- | --- | --- |
| TC-01 Successful create/read | HTTP 201, linked records, exact mock-wallet debit, `in_use` shown by computer API | PASS |
| TC-02 Insufficient balance | HTTP 400, no writes | PASS |
| TC-03 Maintenance computer | HTTP 400, no writes | PASS |
| TC-04 Missing computer ID | HTTP 400, no writes | PASS |

Node test-runner summary: 4 tests, 4 passed, 0 failed. The suite initially exposed a difference between the stored `computer.status` column and the status presented by `GET /api/computers/:id`: the stored column remained `available` after booking, while the API correctly displayed `in_use` using the active rental. The final test verifies the user-facing API status and active rental ID, and this stored-column inconsistency remains an observation for the project team to review. A local pass does not establish that the hosted Supabase project has the same schema or behavior.
