// tests/e2e/flow.test.ts
// Roux Studio — end-to-end flow e2e test (M6 final QA).
//
// Happy path: create a blank project, add a page, insert a section via the insert
// menu, confirm it lands in the layers tree, then open the export dialog and the
// publish guide. Runs in real Chrome against the dev server.
import { test, expect, type Page } from '@playwright/test';

test('create project, add page, insert section, export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  // 1. Create a blank project.
  await page.getByRole('banner').getByRole('button', { name: 'New project' }).click();
  await page.getByRole('button', { name: /Blank project/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  // 2. Switch to the Pages tab and add a page (canvas + layers tree render once a
  //    page exists).
  await page.getByRole('button', { name: 'Pages' }).click();
  await page.getByRole('button', { name: 'New page' }).click();
  await expect(page.locator('iframe').first()).toBeVisible();

  // Switch back to Layers tree; the new page row is visible there.
  await page.getByRole('button', { name: 'Layers' }).click();
  await expect(page.getByText('Page 1')).toBeVisible();

  // 3. Open the insert menu and add a section.
  await page.getByRole('button', { name: 'Insert element' }).click();
  await page.locator('[title="Section"]').click();

  // The inserted section appears in the layers tree under the page.
  await expect(page.getByRole('button', { name: /^Section / })).toBeVisible();

  // 4. Open the export dialog and the publish guide.
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('heading', { name: 'Export site' })).toBeVisible();
  await page.locator('text=How to publish').click();
  await expect(page.getByRole('heading', { name: 'Publish your site' })).toBeVisible();

  expect(errors).toEqual([]);
});
