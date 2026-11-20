// tests/e2e/smoke.test.ts
// Roux Studio — e2e smoke tests (M6 final QA).
//
// Verifies the editor shell loads in a real browser without uncaught errors.
// Run with: pnpm playwright test
import { test, expect } from '@playwright/test';

test('editor shell loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  // Editor shell present (left panel tab + top bar).
  await expect(page.getByRole('button', { name: 'Layers' })).toBeVisible();
  await expect(page.locator('main')).toBeVisible();

  expect(errors).toEqual([]);
});
