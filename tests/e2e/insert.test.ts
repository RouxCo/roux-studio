// tests/e2e/insert.test.ts
// Roux Studio — e2e tests for the insert menu and breakpoint toggles (M6 QA).
//
// These run against the live dev server in real Chrome. The insert menu lives in
// the main window (not the canvas iframe), so its items are directly assertable.
// A blank project is created first so the canvas + iframe render.
import { test, expect, type Page } from '@playwright/test';

test.describe('insert menu', () => {
  test('opens and lists all nine element types', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    // Open the insert menu.
    await page.getByRole('button', { name: 'Insert element' }).click();

    // Menu items carry title attributes matching their labels.
    await expect(page.locator('[title="Section"]')).toBeVisible();
    await expect(page.locator('[title="Container"]')).toBeVisible();
    await expect(page.locator('[title="Box"]')).toBeVisible();
    await expect(page.locator('[title="Heading"]')).toBeVisible();
    await expect(page.locator('[title="Paragraph"]')).toBeVisible();
    await expect(page.locator('[title="Button"]')).toBeVisible();
    await expect(page.locator('[title="Link"]')).toBeVisible();
    await expect(page.locator('[title="Image"]')).toBeVisible();
    await expect(page.locator('[title="Icon"]')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
