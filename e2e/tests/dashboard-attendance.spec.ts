import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@cms.local";
const ADMIN_PASSWORD = "Admin@12345";
const RUN_ID = Date.now();

test("admin marks attendance and sees it reflected on the dashboard and the student's profile", async ({ page }) => {
  const deptName = `Att Dashboard Dept ${RUN_ID}`;
  const courseName = `Att Dashboard Course ${RUN_ID}`;
  const admissionNumber = `ATT-DASH-${RUN_ID}`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // Dashboard loads with gradient stat cards and charts, not blank/broken.
  await expect(page.getByText("Students").first()).toBeVisible();
  await expect(page.getByText("Teaching Staff")).toBeVisible();
  await expect(page.getByText("Attendance Today")).toBeVisible();
  await expect(page.getByText("New Registrations")).toBeVisible();
  await expect(page.getByText("Students by Department")).toBeVisible();
  await expect(page.getByText("Attendance % Trend")).toBeVisible();

  // Range selector switches without erroring.
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.getByText("New Registrations")).toBeVisible();
  await page.getByRole("button", { name: "Month" }).click();

  // --- Set up a department/course/student to mark attendance against ---
  await page.getByRole("link", { name: "Departments" }).click();
  await page.getByPlaceholder("New department name").fill(deptName);
  await page.getByRole("button", { name: "Add Department" }).click();
  await expect(page.getByText(deptName)).toBeVisible();

  await page.getByRole("link", { name: "Courses" }).click();
  await page.getByRole("combobox").first().selectOption({ label: deptName });
  await page.getByPlaceholder("Course name").fill(courseName);
  await page.getByRole("button", { name: "Add Course" }).click();
  await expect(page.getByText(courseName)).toBeVisible();

  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("button", { name: "Register Student" }).click();
  await page.getByPlaceholder("First name").fill("Attendance");
  await page.getByPlaceholder("Last name").fill("Demo");
  await page.locator('input[type="date"]').fill("2005-05-05");
  await page.getByRole("combobox").filter({ hasText: "Gender" }).selectOption("female");
  await page.getByPlaceholder("Mobile number").fill("9988776655");
  await page.locator("form").getByPlaceholder("Admission number").fill(admissionNumber);
  await page.getByRole("combobox").filter({ hasText: "Department" }).selectOption({ label: deptName });
  await page.getByRole("combobox").filter({ hasText: "Course" }).selectOption({ label: courseName });
  await page.getByRole("button", { name: "Save Student" }).click();
  await page.getByPlaceholder(/Search by name/).fill(admissionNumber);
  await expect(page.getByText("Attendance Demo")).toBeVisible();

  // --- Mark attendance for today via the Attendance page ---
  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await page.getByRole("combobox").nth(0).selectOption({ label: deptName });
  const row = page.locator("tr", { hasText: "Attendance Demo" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Present" }).click();
  await page.getByRole("button", { name: "Save Attendance" }).click();
  await expect(page.getByText(/Saved attendance for/)).toBeVisible();

  // --- Dashboard now shows non-zero attendance today ---
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText(/\d+\/\d+ present/)).toBeVisible();

  // --- Student profile shows the attendance summary ---
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByPlaceholder(/Search by name/).fill(admissionNumber);
  await page.getByText("Attendance Demo").click();
  await expect(page.getByText("Present 1")).toBeVisible();
});
