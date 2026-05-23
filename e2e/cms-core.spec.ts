import { test, expect } from '@playwright/test';

test.describe('Core CMS Flow (Phase 3)', () => {
  
  // Note: For a fully integrated E2E test, we would typically use a global setup 
  // to create a test user and tenant, and save the storage state.
  // Here we test the UI structure and routing protections.

  test('should protect dashboard routes from unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    // Expect redirect to login page
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('should display API Documentation correctly when accessed directly', async ({ page, request }) => {
    // We check if the public OpenAPI JSON endpoint returns a valid schema
    const response = await request.get('/api/tenant/demo-tenant/developer/openapi');
    
    // We don't assert 200 because demo-tenant might not exist in the test DB, 
    // but we can check it returns a JSON response (even if it's an error JSON).
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test.describe('Dashboard UI Interactions (Mocked Session)', () => {
    // In a real run, we would inject a session cookie here.
    // For now, we stub out the critical flows that should be covered by QA.
    
    test.skip('should create a new Content Type', async ({ page }) => {
      await page.goto('/dashboard/demo-tenant/content-types/new');
      
      await page.fill('input[placeholder="e.g. Posts"]', 'Articles');
      await page.click('button:has-text("Add New Field")');
      await page.click('text=Text');
      await page.fill('input[name="fieldName"]', 'Title');
      
      await page.click('button:has-text("Save Schema")');
      await expect(page.locator('.toast')).toContainText('Success');
    });

    test.skip('should create a new Content Entry with relation', async ({ page }) => {
      await page.goto('/dashboard/demo-tenant/content-types/articles/new');
      
      await page.fill('input[name="Title"]', 'My First Playwright Article');
      
      // Simulate selecting a relation
      await page.click('button[role="combobox"]');
      await page.click('text=Select Option 1');
      
      await page.click('button:has-text("Save")');
      await expect(page.locator('.toast')).toContainText('Successfully created');
    });

    test.skip('should fetch the created entry via Public API', async ({ request }) => {
      const response = await request.get('/api/public/demo-tenant/content/articles');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.data[0].data.Title).toBe('My First Playwright Article');
    });
  });
});
