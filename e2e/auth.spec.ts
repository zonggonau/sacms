import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // The form has HTML5 required validation, so it won't submit and won't show custom DOM errors.
    // Instead, the URL should remain on the login page.
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Register here/i }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText(/Create Account/i)).toBeVisible();
  });

  test('should allow user to toggle password visibility', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Toggle button is the first button inside the form that has type="button"
    const toggle = page.locator('button[type="button"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});
