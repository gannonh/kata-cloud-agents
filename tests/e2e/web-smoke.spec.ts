import { expect, test } from '@playwright/test';

test('web app smoke: title and shared button are visible', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Kata Cloud Agents (Web)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shared UI works' })).toBeVisible();
});
