import { test, expect } from '@playwright/test';

test('has title and landing page content', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/SACMS/);

  // Check for the "Get Started" button
  const getStarted = page.getByRole('link', { name: /Get Started/i }).first();
  await expect(getStarted).toBeVisible();
});

test('can navigate to login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Sign In/i }).first().click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/Welcome Back/i)).toBeVisible();
});
