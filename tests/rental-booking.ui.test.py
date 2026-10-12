"""Playwright browser tests for the PC rental booking flow.

This suite only accepts the disposable local database configured by
scripts/run-rental-tests.ps1. It creates unique fixtures and removes them
after the run.
"""

import os
import re
import unittest
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import psycopg
from playwright.sync_api import Error as PlaywrightError, sync_playwright


BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:3000").rstrip("/")
DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
RUN_ID = uuid.uuid4().hex[:10].upper()
PASSWORD = "RentalUiTest123!"


def _assert_isolated_test_environment() -> None:
    if os.environ.get("TEST_DB_ISOLATED") != "yes":
        raise AssertionError("Set TEST_DB_ISOLATED=yes only when using a disposable test database")
    if not DATABASE_URL:
        raise AssertionError("TEST_DATABASE_URL must identify the test database")
    db_host = psycopg.conninfo.conninfo_to_dict(DATABASE_URL).get("host")
    if db_host not in ("localhost", "127.0.0.1", "::1"):
        raise AssertionError("UI tests must never connect to hosted Supabase or Render data")
    app_host = BASE_URL.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]
    if app_host not in ("localhost", "127.0.0.1", "::1"):
        raise AssertionError("UI tests must only use the local test server")


def _start_time() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class RentalBookingUiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _assert_isolated_test_environment()
        cls.email = f"rental-ui-{RUN_ID.lower()}@example.invalid"
        cls.computers: dict[str, int] = {}

        with sync_playwright() as playwright:
            request = playwright.request.new_context()
            response = request.post(
                f"{BASE_URL}/api/auth/register",
                data={"email": cls.email, "password": PASSWORD, "fullName": "Rental UI Test"},
                timeout=10_000,
            )
            if response.status != 201:
                raise AssertionError(f"Could not create isolated UI test account: HTTP {response.status}")
            cls.customer_id = int(response.json()["user"]["customerId"])
            request.dispose()

        with psycopg.connect(DATABASE_URL) as db:
            db.execute("UPDATE customer SET email_verified = TRUE WHERE customer_id = %s", (cls.customer_id,))
            db.execute("UPDATE wallet SET balance = 100.00 WHERE customer_id = %s", (cls.customer_id,))
            for suffix, status, price in (
                ("OK", "available", 25.00),
                ("LOW", "available", 150.00),
                ("MAINT", "maintenance", 25.00),
            ):
                row = db.execute(
                    """INSERT INTO computer
                       (computer_code, cpu, ram, gpu, storage, price_per_hour, status)
                       VALUES (%s, 'UI Test CPU', '16GB', 'UI Test GPU', '512GB SSD', %s, %s)
                       RETURNING computer_id""",
                    (f"UI-{RUN_ID}-{suffix}", price, status),
                ).fetchone()
                cls.computers[suffix] = int(row[0])

        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except PlaywrightError:
            # Some managed workstations already have Chrome but not the separate
            # Playwright browser bundle. Prefer the pinned browser when present.
            cls.browser = cls.playwright.chromium.launch(
                channel=os.environ.get("PLAYWRIGHT_BROWSER_CHANNEL", "chrome"),
                headless=True,
            )

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "browser"):
            cls.browser.close()
            cls.playwright.stop()
        if not hasattr(cls, "customer_id"):
            return
        with psycopg.connect(DATABASE_URL) as db:
            db.execute(
                "DELETE FROM wallet_transaction WHERE wallet_id IN (SELECT wallet_id FROM wallet WHERE customer_id = %s)",
                (cls.customer_id,),
            )
            db.execute(
                "DELETE FROM session_extension WHERE session_id IN (SELECT s.session_id FROM session s JOIN rental r ON r.rental_id = s.rental_id WHERE r.customer_id = %s)",
                (cls.customer_id,),
            )
            db.execute("DELETE FROM session WHERE rental_id IN (SELECT rental_id FROM rental WHERE customer_id = %s)", (cls.customer_id,))
            db.execute("DELETE FROM rating WHERE customer_id = %s", (cls.customer_id,))
            db.execute("DELETE FROM rental WHERE customer_id = %s", (cls.customer_id,))
            db.execute("DELETE FROM reservation WHERE customer_id = %s", (cls.customer_id,))
            db.execute("DELETE FROM email_token WHERE customer_id = %s", (cls.customer_id,))
            db.execute("DELETE FROM wallet WHERE customer_id = %s", (cls.customer_id,))
            db.execute("DELETE FROM computer WHERE computer_id = ANY(%s)", (list(cls.computers.values()),))
            db.execute("DELETE FROM customer WHERE customer_id = %s", (cls.customer_id,))

    def setUp(self) -> None:
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.page.goto(f"{BASE_URL}/pages/login.html", wait_until="networkidle")
        self.page.locator('input[name="email"]').fill(self.email)
        self.page.locator('input[name="password"]').fill(PASSWORD)
        self.page.locator('#login-form button[type="submit"]').click()
        self.page.wait_for_url(re.compile(r"/pages/index\.html$"), timeout=10_000)

    def tearDown(self) -> None:
        self.context.close()

    def test_01_customer_can_book_an_available_computer(self) -> None:
        computer_id = self.computers["OK"]
        code = f"UI-{RUN_ID}-OK"
        self.page.goto(f"{BASE_URL}/pages/computer.html?id={computer_id}", wait_until="networkidle")
        self.page.locator(".booking-panel").wait_for()
        self.page.locator("#hours").select_option("1")
        self.page.locator("#go-book").click()
        self.page.wait_for_url(re.compile(r"/pages/booking\.html\?"), timeout=10_000)
        self.page.get_by_role("heading", name=re.compile("ตรวจสอบและยืนยันการใช้บริการ")).wait_for()
        self.page.locator("#confirm").click()
        self.page.wait_for_url(re.compile(r"/pages/rental\.html$"), timeout=10_000)
        rental_card = self.page.locator(f'.rental-card:has-text("{code}")')
        rental_card.wait_for(timeout=10_000)
        self.assertIn("กำลังใช้งาน", rental_card.inner_text())

    def test_02_customer_sees_error_when_wallet_is_insufficient(self) -> None:
        computer_id = self.computers["LOW"]
        query = urlencode({"id": computer_id, "hours": 1, "start": _start_time()})
        with psycopg.connect(DATABASE_URL) as db:
            before = db.execute(
                """SELECT (SELECT COUNT(*) FROM rental WHERE customer_id = %s),
                          (SELECT COUNT(*) FROM reservation WHERE customer_id = %s),
                          (SELECT balance FROM wallet WHERE customer_id = %s)""",
                (self.customer_id, self.customer_id, self.customer_id),
            ).fetchone()
        self.page.goto(f"{BASE_URL}/pages/booking.html?{query}", wait_until="networkidle")
        self.page.locator("#confirm").wait_for()
        self.page.locator("#confirm").click()
        alert = self.page.locator("#msg .alert.error")
        alert.wait_for(timeout=10_000)
        self.assertRegex(alert.inner_text(), re.compile("ไม่เพียงพอ"))
        self.assertTrue(self.page.locator("#confirm").is_enabled())
        with psycopg.connect(DATABASE_URL) as db:
            after = db.execute(
                """SELECT (SELECT COUNT(*) FROM rental WHERE customer_id = %s),
                          (SELECT COUNT(*) FROM reservation WHERE customer_id = %s),
                          (SELECT balance FROM wallet WHERE customer_id = %s)""",
                (self.customer_id, self.customer_id, self.customer_id),
            ).fetchone()
        self.assertEqual(after, before, "Rejected UI booking changed rental records or wallet balance")

    def test_03_maintenance_computer_has_no_booking_controls(self) -> None:
        computer_id = self.computers["MAINT"]
        self.page.goto(f"{BASE_URL}/pages/computer.html?id={computer_id}", wait_until="networkidle")
        self.page.get_by_text("เครื่องนี้อยู่ระหว่างการปรับปรุงและยังไม่เปิดให้จอง").wait_for()
        self.assertFalse(self.page.locator("#go-book").count())
        self.assertTrue(self.page.locator(".badge.maintenance").is_visible())

    def test_04_booking_page_rejects_missing_start_time(self) -> None:
        computer_id = self.computers["OK"]
        self.page.goto(
            f"{BASE_URL}/pages/booking.html?id={computer_id}&hours=1",
            wait_until="networkidle",
        )
        self.page.locator(".alert.error").wait_for()
        self.assertIn("ข้อมูลการเลือกเครื่องหรือเวลาไม่ถูกต้อง", self.page.locator(".alert.error").inner_text())
        self.assertFalse(self.page.locator("#confirm").count())


if __name__ == "__main__":
    unittest.main(verbosity=2)
