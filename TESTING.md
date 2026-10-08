# Rental booking API tests

The four cases use the application API and verify the resulting PostgreSQL records. The test runner creates a unique verified customer, mock wallet, and three computers, then removes only those test records during normal teardown. It never calls top-up, QR payment, or a real payment provider.

## Setup

1. Use the separate Supabase PostgreSQL test project `finaly`. Its Table Editor shows the required tables. Do not run `database/schema.sql` or `npm run seed` against an existing database; both replace application data.
2. Run `npm ci` in this checkout.
3. From this folder, run `powershell -NoProfile -File scripts/run-rental-tests.ps1`. Paste the **Session pooler** URI from Supabase Connect with `[YOUR-PASSWORD]` still in it. Enter the database password at the hidden prompt, then confirm that the URI is for `finaly`. The script checks the required columns, starts a local server, runs the four tests, and stops the server. It does not save the password or connection URI to a file.
4. Save the test runner output and Git commit in `TEST_REPORT.md` after a formal run. Do not include connection strings, tokens, or passwords in the report.

The session pooler URI and database password are PostgreSQL credentials, not Supabase API keys. Do not paste an `.env` file into the project or GitHub. The password must be entered locally at the script prompt.

For a manual run, set `DATABASE_URL` and `TEST_DATABASE_URL` to the same isolated database, `DB_SSL=true`, `TEST_DB_ISOLATED=yes`, `TEST_BASE_URL=http://localhost:3000`, and a local `JWT_SECRET`; start `npm start` in one terminal and run `npm run test:rental` in another.

The test runner refuses to run without the isolated-database acknowledgement or when `TEST_BASE_URL` is not local. It confirms the server is using the same database by logging in with the customer it just created. Teardown ends the created rental, deletes its linked rows and the generated fixtures, and leaves pre-existing customer and computer records untouched. An interrupted process may leave uniquely named `rental-test-*` and `T-*` fixtures for manual review.
