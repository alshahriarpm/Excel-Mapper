import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end journeys against DEMO mode (in-memory backend). Serial: the demo
 * backend is shared server state, and the later admin tests mutate it, so the
 * destructive ones run last.
 */

const ADMIN_EMAIL = "admin@bulkmapper.app";
const ADMIN_PASSWORD = "Admin12345!";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
}

test.describe.serial("Bulk Mapper — demo mode journeys", () => {
  test("unauthenticated visitors are sent to login (demo mode active)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/Demo mode/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("HR email routes to HR home", async ({ page }) => {
    await signIn(page, "hr@acme.test", "whatever");
    await page.waitForURL(/\/hr$/);
    await expect(page.getByText("Pick a template to begin")).toBeVisible();
    await signOut(page);
  });

  test("admin email routes to Admin Studio, and HR area is blocked for admin", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /What would you like to do\?/ })).toBeVisible();
    // Role separation: a super-admin cannot land in the HR area.
    await page.goto("/hr");
    await expect(page).toHaveURL(/\/admin$/);
    await signOut(page);
  });

  test("HR converts the sample data and downloads the target file", async ({ page }) => {
    await signIn(page, "hr@acme.test", "whatever");
    await page.waitForURL(/\/hr$/);
    await page.getByText("Monthly Attendance Import").click();
    await page.waitForURL(/\/hr\/convert\/demo-template/);

    await page.getByRole("button", { name: "Try with sample data" }).click();

    // Engine computed 3 ready rows from the 5-row sample.
    await expect(page.getByRole("button", { name: /Download ready only \(3\)/ })).toBeVisible();
    // A distinct status badge from the overnight/next-day logic.
    await expect(page.getByText("Next-Day Record Missing")).toBeVisible();
    await expect(page.getByText("Attendance Bulk Upload.xlsx")).toBeVisible();

    // Download uses the saved target filename.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download ready only/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Attendance Bulk Upload.xlsx");

    await signOut(page);
  });

  test("admin blocks then unblocks an HR user", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/companies");
    await expect(page.getByText(/Demo HR/)).toBeVisible();

    await page.getByRole("button", { name: "Block this account" }).click();
    await expect(page.getByText("Blocked")).toBeVisible();

    await page.getByRole("button", { name: "Unblock this account" }).click();
    await expect(page.getByRole("button", { name: "Block this account" })).toBeVisible();
    await signOut(page);
  });

  test("company delete is guarded while it still has a template", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/companies");

    await page.getByRole("button", { name: "Delete this company" }).click();
    // Confirm without ticking "force" — should be refused.
    await page.getByRole("button", { name: "Delete company" }).click();
    await expect(page.getByText(/still has .* template/i)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await signOut(page);
  });

  test("force-delete removes the company and everything under it", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin/companies");

    await page.getByRole("button", { name: "Delete this company" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Force delete everything" }).click();
    await expect(page.getByText("No companies yet")).toBeVisible();
  });
});
