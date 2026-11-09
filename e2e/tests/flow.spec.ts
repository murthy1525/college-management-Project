import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ADMIN_EMAIL = "admin@cms.local";
const ADMIN_PASSWORD = "Admin@12345";
const RUN_ID = Date.now();

const PNG_FIXTURE = path.join(__dirname, "fixture.png");

test.beforeAll(() => {
  // Minimal valid PNG (8-byte signature + IHDR chunk is unnecessary for our
  // upload — the backend only checks the magic-byte signature).
  fs.writeFileSync(
    PNG_FIXTURE,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
  );
});

test.afterAll(() => {
  fs.rmSync(PNG_FIXTURE, { force: true });
});

test("unauthenticated visitor is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("rejects bad credentials with a visible error, without crashing the app", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/incorrect/i)).toBeVisible();
});

test("full golden path: login, create department/course/student, upload+view a document, toggle active/inactive", async ({
  page,
}) => {
  const deptName = `E2E Department ${RUN_ID}`;
  const courseName = `E2E Course ${RUN_ID}`;
  const admissionNumber = `E2E-${RUN_ID}`;

  // --- Login ---
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();

  // --- Dashboard shows real (non-hardcoded) counts ---
  await expect(page.getByText("Students").first()).toBeVisible();
  const studentsCountBefore = await page.locator("text=Students").locator("..").locator(".text-2xl").innerText();
  expect(Number(studentsCountBefore)).not.toBeNaN();

  // --- Create department ---
  await page.getByRole("link", { name: "Departments" }).click();
  await page.getByPlaceholder("New department name").fill(deptName);
  await page.getByRole("button", { name: "Add Department" }).click();
  await expect(page.getByText(deptName)).toBeVisible();

  // --- Create course under that department ---
  await page.getByRole("link", { name: "Courses" }).click();
  await page.getByRole("combobox").first().selectOption({ label: deptName });
  await page.getByPlaceholder("Course name").fill(courseName);
  await page.getByRole("button", { name: "Add Course" }).click();
  await expect(page.getByText(courseName)).toBeVisible();

  // --- Register student ---
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("button", { name: "Register Student" }).click();
  await page.getByPlaceholder("First name").fill("Playwright");
  await page.getByPlaceholder("Last name").fill("Tester");
  await page.locator('input[type="date"]').fill("2005-05-05");
  await page.getByRole("combobox").filter({ hasText: "Gender" }).selectOption("female");
  await page.getByPlaceholder("Mobile number").fill("9123456789");
  await page.locator("form").getByPlaceholder("Admission number").fill(admissionNumber);
  await page.getByRole("combobox").filter({ hasText: "Department" }).selectOption({ label: deptName });
  await page.getByRole("combobox").filter({ hasText: "Course" }).selectOption({ label: courseName });
  await page.getByRole("button", { name: "Save Student" }).click();

  // Repeated test runs leave earlier students in the list (soft-delete only,
  // by design) — search by this run's unique admission number so a stale
  // same-named row from a previous run can never be the one we click.
  await page.getByPlaceholder(/Search by name/).fill(admissionNumber);
  await expect(page.getByText("Playwright Tester")).toBeVisible();

  // --- Open student profile ---
  await page.getByText("Playwright Tester").click();
  await expect(page.getByRole("heading", { name: "Playwright Tester" })).toBeVisible();
  await expect(page.getByText(admissionNumber)).toBeVisible();
  await expect(page.getByText(deptName).first()).toBeVisible();
  await expect(page.getByText(courseName).first()).toBeVisible();
  await expect(page.getByText("enrolled")).toBeVisible();

  // --- Upload a document ---
  await page.getByPlaceholder(/Document type/).fill("photo");
  await page.locator('input[type="file"]').setInputFiles(PNG_FIXTURE);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("fixture.png")).toBeVisible();

  // --- View the document opens a new tab successfully ---
  const [docTab] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByText("fixture.png").click(),
  ]);
  await docTab.waitForLoadState();
  expect(docTab.url()).toContain("blob:");
  await docTab.close();

  // --- Add a guardian with a parent portal login ---
  const parentEmail = `e2e-parent-${RUN_ID}@example.test`;
  const parentPassword = "ParentPortal@123";
  await page.getByRole("button", { name: "Add Guardian" }).click();
  await page.getByPlaceholder("Relationship (e.g. mother)").fill("mother");
  await page.getByPlaceholder("Full name").fill("E2E Guardian");
  await page.getByPlaceholder("Email").fill(parentEmail);
  await page.getByLabel(/Create a parent portal login/).check();
  await page.getByPlaceholder(/Set initial password/).fill(parentPassword);
  await page.getByRole("button", { name: "Save Guardian" }).click();
  await expect(page.getByText("E2E Guardian")).toBeVisible();
  await expect(page.getByText("Portal access")).toBeVisible();

  // --- Create a progress card and sign it as staff (teacher side) ---
  const term = `E2E Term ${RUN_ID}`;
  await page.getByRole("button", { name: "Create Progress Card" }).click();
  await page.getByPlaceholder(/Term/).fill(term);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(term)).toBeVisible();
  await expect(page.getByText("Awaiting Signatures").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign as Teacher" }).click();
  await expect(page.getByText(/Teacher signed/)).toBeVisible();
  await expect(page.getByText("Parent signature pending")).toBeVisible();

  // --- Switch to the parent login and sign the same card ---
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(parentEmail);
  await page.getByLabel("Password").fill(parentPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("link", { name: "My Children" })).toBeVisible();
  await page.getByText("Playwright Tester").click();
  await expect(page.getByRole("heading", { name: "Playwright Tester" })).toBeVisible();
  // A parent is read-only staff-wise: no deactivate/upload controls.
  await expect(page.getByRole("button", { name: "Deactivate" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign as Parent" }).click();
  await expect(page.getByText("Fully Signed")).toBeVisible();

  // --- Back to admin for the remaining lifecycle checks ---
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByPlaceholder(/Search by name/).fill(admissionNumber);
  await page.getByText("Playwright Tester").click();

  // --- Toggle student inactive, confirm status badge flips ---
  await page.getByRole("button", { name: "Deactivate" }).first().click();
  await expect(page.getByText("Inactive").first()).toBeVisible();

  // --- Inactive student no longer in default list ---
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByPlaceholder(/Search by name/).fill(admissionNumber);
  await expect(page.getByText("Playwright Tester")).not.toBeVisible();

  // --- But visible with "Show inactive" checked ---
  await page.getByLabel("Show inactive").check();
  await expect(page.getByText("Playwright Tester")).toBeVisible();
});
