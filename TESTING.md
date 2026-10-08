# Rental booking API tests

The four cases use the application API and verify the resulting PostgreSQL records. The test runner creates a unique verified customer, mock wallet, and three computers, then removes only those test records during normal teardown. It never calls top-up, QR payment, or a real payment provider.

## Setup

1. Use a separate, disposable Supabase PostgreSQL project. Do not use the project behind the shared Render website. If the project is empty, its owner can initialize it with `database/schema.sql` once; that SQL drops existing application tables, so do not run it when the schema is already present. The test runner does **not** execute the schema or seed script.
2. Run `npm ci` in this checkout.
3. Start the application locally with `DATABASE_URL` pointing to the test project, `DB_SSL=true`, and a local `JWT_SECRET`. Supply these through protected environment variables; do not create a `.env` file in the project folder or put secrets in Git.
4. In the terminal running the test process, set `TEST_DATABASE_URL` to the **same test database**, `DB_SSL=true`, `TEST_DB_ISOLATED=yes`, and `TEST_BASE_URL=http://localhost:3000`. Then run `npm run test:rental`.
5. Save the test runner output and Git commit in `TEST_REPORT.md` after a formal run. Do not include connection strings, tokens, or passwords in the report.

The test runner refuses to run without the isolated-database acknowledgement or when `TEST_BASE_URL` is not local. It confirms the server is using the same database by logging in with the customer it just created. Teardown ends the created rental, deletes its linked rows and the generated fixtures, and leaves pre-existing customer and computer records untouched. An interrupted process may leave uniquely named `rental-test-*` and `T-*` fixtures for manual review.
