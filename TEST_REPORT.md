# Rental booking automated test report

- Updated / executed: 2026-10-12 (Asia/Bangkok)
- Test branch: `test-rent-pc-playwright` in `AchirayaSE67/PJ1`, based on the existing test branch for PR #1 and ultimately `main`
- Source project commit: `075071bb91b6077a3166bd18372db7bb5f53356d`
- API suite: `tests/rental-booking.db.test.js` — Node.js `node:test`
- Browser suite: `tests/rental-booking.ui.test.py` — Python `unittest` with Playwright
- Command: `powershell -NoProfile -File scripts/run-rental-tests.ps1`
- Environment: local Node.js server and a fresh, disposable `postgres:16-alpine` container
- Result: **PASS — 8/8 cases (4 API + 4 browser UI)**

## Environment and safety

The junior confirmed the deployed Render website uses Supabase project `finaly`. It is not an isolated test project, so no database-changing tests were run against it and its supplied credentials were not used. The runner created a local PostgreSQL container, initialized the schema only inside that container, ran both suites, and removed the container afterward. Both suites reject non-local database URLs. Test wallet credit is a fixture; no real-money payment or email-provider integration is used.

## API cases

| Case | Expected result | Status |
| --- | --- | --- |
| TC-01 Successful create/read | HTTP 201; linked reservation, rental, session, and wallet transaction; exact mock-wallet debit; computer API displays `in_use` | PASS |
| TC-02 Insufficient balance | HTTP 400; no writes or balance change | PASS |
| TC-03 Maintenance computer | HTTP 400; no writes or balance change | PASS |
| TC-04 Missing computer ID | HTTP 400; no rental created | PASS |

## Playwright browser cases

| Case | Expected result | Status |
| --- | --- | --- |
| UI-01 Available-computer booking | User logs in, chooses a computer, confirms one hour, and sees the active rental on “My Machines” | PASS |
| UI-02 Insufficient wallet | Visible error; confirmation remains enabled; rental/reservation records and balance remain unchanged | PASS |
| UI-03 Maintenance computer | Maintenance explanation is visible and booking controls are absent | PASS |
| UI-04 Missing start time | Invalid-selection message appears and no confirmation button is rendered | PASS |

Node summary: 4 passed, 0 failed. Playwright summary: 4 passed, 0 failed. A prior investigation found that the stored `computer.status` column stays `available` after booking, while `GET /api/computers/:id` correctly reports `in_use` from the active rental. The API test verifies the user-facing API status and active rental ID; the stored-column difference remains an observation for the project team. A local pass does not prove the hosted deployment has the same schema or behavior.
