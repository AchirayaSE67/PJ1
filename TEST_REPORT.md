# Rental booking test execution report

- Date prepared: 2026-10-08 (Asia/Bangkok)
- Test work branch: `test-rent-pc` in the `AchirayaSE67/PJ1` fork (based on `main`)
- Target commit: `075071bb91b6077a3166bd18372db7bb5f53356d`
- Suite: `tests/rental-booking.db.test.js`
- Command: `npm run test:rental`
- Result: **Not executed against a database yet**

## Reason

The user confirmed that Supabase project `finaly` is an isolated test project, but no database connection was present in the local environment. The shared Render deployment was inspected read-only and login was verified; state-changing booking tests were not executed against it. `npm ci` completed, `node --check tests/rental-booking.db.test.js` passed, and `git diff --check` found no whitespace errors. A preflight run stopped before connecting or writing because `TEST_DB_ISOLATED` and `TEST_DATABASE_URL` were unset. The four integration cases remain unexecuted.

## Planned cases

| Case | Expected result | Status |
| --- | --- | --- |
| TC-01 Create rental successfully | HTTP 201, readable active rental, linked database rows, exact mock-wallet deduction | NOT RUN |
| TC-02 Insufficient mock-wallet balance | HTTP 400, no persistent writes or wallet change | NOT RUN |
| TC-03 Maintenance computer | HTTP 400, no persistent writes or wallet change | NOT RUN |
| TC-04 Missing required booking data | HTTP 400, no persistent writes | NOT RUN |

After a disposable test database is configured, run the command above and replace this status with the Node test-runner output. The suite creates and removes its own fixtures; do not run the destructive seed script as a routine test step.
