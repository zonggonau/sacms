import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('has title and landing page content', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/SaCMS/i);

  // Check for the "Get Started" button
  const getStarted = page.getByRole('link', { name: /Mulai Sekarang/i }).first();
  await expect(getStarted).toBeVisible();
});

test('can navigate to login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Masuk/i }).first().click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();
});
