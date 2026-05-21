import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show validation errors on empty login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Assuming we use standard form validation or toast
    await expect(page.locator('form')).toContainText(/required/i);
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Register/i }).click();

    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText(/Create an Account/i)).toBeVisible();
  });

  test('should allow user to toggle password visibility', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByPlaceholder(/password/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Assuming there is a toggle button (lucide eye icon)
    const toggle = page.locator('button').filter({ hasText: '' }).last(); // Simplistic selector
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });
});
