import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@cms.local";
const ADMIN_PASSWORD = "Admin@12345";
const RUN_ID = Date.now();

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("admin sees the full menu including Staff Accounts, and can create a lecturer login", async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL("/");

  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Departments" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Courses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff Accounts" })).toBeVisible();

  await page.getByRole("link", { name: "Staff Accounts" }).click();
  await page.getByRole("button", { name: "Create Staff Login" }).click();

  const email = `lecturer-${RUN_ID}@example.test`;
  const fullName = `Dr. Playwright Rao ${RUN_ID}`;
  await page.getByPlaceholder("Full name").fill(fullName);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder(/Initial password/).fill("LecturerPass@123");
  await page.getByRole("combobox").selectOption("lecturer");
  await page.getByRole("button", { name: "Create Login" }).click();

  await expect(page.getByText(fullName)).toBeVisible();

  // --- Switch to the lecturer login and confirm the separate, scoped-down menu ---
  await page.locator("aside button[title='Log out']").click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, email, "LecturerPass@123");
  await expect(page).toHaveURL("/");

  // Lecturer's menu is deliberately smaller than admin's.
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Departments" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Courses" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Staff Accounts" })).toHaveCount(0);

  // Going straight to the admin-only URL redirects back home instead of showing the page.
  await page.goto("/staff");
  await expect(page).toHaveURL("/");

  // On the Students list, a lecturer has no "Register Student" button (admin/hod only).
  await page.goto("/students");
  await expect(page.getByRole("button", { name: "Register Student" })).toHaveCount(0);
});
