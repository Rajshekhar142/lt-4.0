import { test, expect } from '@playwright/test';

test('track time with note and verify in history', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const domainButton = page.locator('button').first();
  await domainButton.click(); // Start — this is likely what makes the note input appear

  const noteInput = page.locator('input[placeholder*="What are you working on"]');
  await noteInput.fill('E2E testing note feature');

  await domainButton.click(); // Stop — description should get passed to stopEntryAction here

  await page.goto('http://localhost:3000/history');
  await expect(page.locator('text=E2E testing note feature')).toBeVisible();
});