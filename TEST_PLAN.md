# PJ1 PC Rental Booking Automated Test Plan

## Scope

Core feature: a customer creates a computer rental using mock wallet balance. Source: the PJ1 `main` branch; test work: `test-rent-pc`. The application uses Supabase PostgreSQL, while this suite runs on disposable local PostgreSQL to protect the database used by the Render deployment.

The API supports Create, Read, and ending a rental (status update), but has no rental Delete endpoint. The four cases cover the required Create flow and principal rejection paths, not full CRUD.

## Cases

| ID | Action | Expected result |
| --- | --- | --- |
| TC-01 | Create a one-hour rental for an available computer with sufficient mock-wallet credit | HTTP 201 and an active rental ID. Read returns the same rental. Reservation, rental, session, and wallet transaction exist; the wallet decreases by the price and the computer API displays `in_use` with the active rental ID. |
| TC-02 | Request a rental costing more than the mock-wallet balance | HTTP 400; no new records or wallet change. |
| TC-03 | Attempt to rent a computer in `maintenance` | HTTP 400; no new records or wallet change. |
| TC-04 | Submit a booking without `computerId` | HTTP 400; no new records. |

The suite creates its own verified customer, wallet, and computers. It ends its successful rental and removes its fixtures during normal teardown. Rejected bookings must not leave partial records.

## Execution and evidence

Run `npm ci`, start Docker Desktop, then run `powershell -NoProfile -File scripts/run-rental-tests.ps1`. The runner uses a fresh local PostgreSQL container, initializes `database/schema.sql` there, starts the local API, checks the schema, runs `npm run test:rental`, and removes the container. Record the date, commit, per-case result, and any defects in `TEST_REPORT.md`.

The booking request requires `computerId`, `hours`, and `startTime`. The current server starts the rental at confirmation time; these tests do not assume future scheduling.

## Safety and limitations

The junior confirmed the Render website uses Supabase project `finaly`. It is not an isolated test project. Never point the suite, destructive schema initialization, or seed command at it. The test file enforces a loopback database URL. Mock wallet credit is created as a fixture; top-up, PromptPay QR, payment webhooks, and real money are outside scope. A passing local run validates application/database behavior, not the live Supabase deployment.
