# PJ1 PC Rental Booking Automated Test Plan

## Scope

Core feature: a customer creates a computer rental using the application's wallet balance. The source is the current `main` branch; this test work is on `test-rent-pc`. The backend uses Supabase PostgreSQL. These tests cover the booking endpoint and its main business rules, without exercising a real payment provider.

The rental API supports Create, Read, and ending an active rental (a status update). It has no rental Delete endpoint. The four cases focus on the required Create flow and its rejection paths, so they are not presented as a complete CRUD suite.

## Cases

| ID | Action | Expected result |
| --- | --- | --- |
| TC-01 | Create a one-hour rental for an available computer using a verified customer with sufficient mock-wallet credit | HTTP 201 with a rental ID, customer ID, computer ID, and active status. A subsequent read returns the same rental. The matching reservation, rental, session, and wallet transaction exist; the wallet decreases by the quoted price and the computer becomes `in_use`. |
| TC-02 | Request a rental whose price exceeds the customer's mock-wallet balance | HTTP 400 with an insufficient-balance message. No new reservation, rental, session, or wallet transaction remains, and the wallet balance is unchanged. |
| TC-03 | Attempt to rent a computer in `maintenance` status | HTTP 400 with a maintenance message. No rental-related records are created and the wallet balance is unchanged. |
| TC-04 | Submit a booking without the required `computerId` | HTTP 400 with a required-data message. No rental-related records are created. |

The suite creates uniquely named customer, wallet, and computer fixtures in an isolated database. Teardown ends the rental and removes only those fixtures and their linked rows. Failed booking cases must leave no partial records.

## Setup and execution

1. Use the separate Supabase PostgreSQL test project `finaly`, never the database behind the shared Render deployment. The database must already contain the application's current tables. Do not run `database/schema.sql` against a populated project because it drops tables.
2. Install Node.js dependencies with `npm ci`. The test runner creates its own verified customer, mock wallet, and computers; `npm run seed` is not needed and must not be used as a routine test step.
3. Configure the local server with protected environment variables for the test database connection (`DATABASE_URL`), `DB_SSL=true`, and a local `JWT_SECRET`. Do not create a `.env` file in the project folder or put credentials in source files or reports.
4. Start the application with `npm start`. For the test process, set `TEST_DATABASE_URL` to the same isolated database, `DB_SSL=true`, `TEST_DB_ISOLATED=yes`, and `TEST_BASE_URL=http://localhost:3000`; then run `npm run test:rental`.
5. Save the test runner output, execution date, Git commit, and PASS/FAIL result for each case in `TEST_REPORT.md`. Record any database assertions or defects separately from the plan.

The booking request requires `computerId`, `hours`, and `startTime`. The server currently starts a successful rental at confirmation time, regardless of the submitted `startTime`; the tests check that behavior rather than assume a future reservation.

## Database and payment safety

`database/schema.sql` drops application tables before recreating them, and `npm run seed` replaces application data. Use either only when intentionally preparing an empty, isolated test project. The suite generates its own mock-wallet credit; do not invoke top-up, PromptPay QR, payment webhook, or real-money flows.
