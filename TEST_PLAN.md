# PJ1 PC Rental Booking Automated Test Plan

## Scope

Core feature: a customer creates a computer rental using mock wallet balance. Source: the PJ1 `main` branch; test work: `test-rent-pc-playwright`. The application uses Supabase PostgreSQL, while these suites run on disposable local PostgreSQL to protect the database used by the Render deployment.

The API supports Create, Read, and ending a rental (status update), but has no rental Delete endpoint. The four cases cover the required Create flow and principal rejection paths, not full CRUD.

## Cases

| ID | Action | Expected result |
| --- | --- | --- |
| TC-01 | Create a one-hour rental for an available computer with sufficient mock-wallet credit | HTTP 201 and an active rental ID. Read returns the same rental. Reservation, rental, session, and wallet transaction exist; the wallet decreases by the price and the computer API displays `in_use` with the active rental ID. |
| TC-02 | Request a rental costing more than the mock-wallet balance | HTTP 400; no new records or wallet change. |
| TC-03 | Attempt to rent a computer in `maintenance` | HTTP 400; no new records or wallet change. |
| TC-04 | Submit a booking without `computerId` | HTTP 400; no new records. |

The API suite creates its own verified customer, wallet, and computers. The UI suite registers a uniquely named test customer through the local app, verifies that account in the disposable database, and creates separate available, expensive, and maintenance computers. Each suite removes its own fixtures during teardown. Rejected bookings must not leave partial records.

## Browser cases

| ID | Action | Expected result |
| --- | --- | --- |
| UI-01 | Log in, choose an available computer, select one hour, and confirm the booking | The browser reaches “My Machines” and displays the new active rental for the selected computer. |
| UI-02 | Confirm a booking whose price exceeds the test wallet balance | The page displays the insufficient-credit error and keeps the confirmation button available; no rental is created. |
| UI-03 | Open a computer in maintenance | The maintenance status and explanation are visible; booking controls are absent. |
| UI-04 | Open the booking confirmation page without a start time | The page displays the invalid-selection message and does not render a confirmation button. |

## Execution and evidence

Run `npm ci`, install the browser-test dependencies with `python -m pip install -r requirements-test.txt`, install Chromium with `python -m playwright install chromium`, start Docker Desktop, then run `powershell -NoProfile -File scripts/run-rental-tests.ps1`. The runner uses a fresh local PostgreSQL container, initializes `database/schema.sql` there, starts the local API, checks the schema, runs the four Node API tests and four Python Playwright UI tests, records one 1280x720 WebM video for each UI case, and removes the container. The videos and their manifest are written under `test-results/videos/<run timestamp>/`. Record the date, commit, per-case result, and uploaded video link in the submission sheet.

The booking request requires `computerId`, `hours`, and `startTime`. The current server starts the rental at confirmation time; these tests do not assume future scheduling.

## Safety and limitations

The junior confirmed the Render website uses Supabase project `finaly`. It is not an isolated test project. Never point the suite, destructive schema initialization, or seed command at it. The test file enforces a loopback database URL. Mock wallet credit is created as a fixture; top-up, PromptPay QR, payment webhooks, and real money are outside scope. A passing local run validates application/database behavior, not the live Supabase deployment.
