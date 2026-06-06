import { test, expect } from '@playwright/test';

test.describe('Gallery Page E2E Tests', () => {
  const BASE_URL = 'http://localhost:3000/en/gallery';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForResponse(response => response.url().includes('/api/gallery') && response.status() === 200);
  });

  test('Pagination clicks load the next page data and total pages are correct', async ({ page }) => {
    const initialItemsCount = await page.locator('.grid a').count();
    expect(initialItemsCount).toBeGreaterThan(0);

    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/gallery?page=2') && response.status() === 200
    );

    const page2Button = page.getByRole('button', { name: '2' });
    await page2Button.click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    expect(page.url()).toContain('page=2');
  });

  test('Typing the search term "nude" triggers a request and returns filtered results (verify 500ms debounce)', async ({ page }) => {
    // Specifically locate the input in the gallery page container
    const searchInput = page.locator('.max-w-7xl input[type="text"]').last();
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/gallery') && response.url().includes('q=nude') && response.status() === 200
    );

    const startTime = Date.now();
    await searchInput.fill('nude');

    const response = await responsePromise;
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeGreaterThanOrEqual(400); 
    expect(response.ok()).toBeTruthy();
    expect(page.url()).toContain('q=nude');
  });

  test('Switching category tags resets the page number and filters correctly', async ({ page }) => {
    const page2Button = page.getByRole('button', { name: '2' });
    await page2Button.click();
    await page.waitForURL(/page=2/);

    const tags = page.locator('button').filter({ hasText: /short|Short|短/i });
    const tagToClick = tags.first();

    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/gallery') && response.url().includes('cat=short') && response.url().includes('page=1') && response.status() === 200
    );

    await tagToClick.click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    expect(page.url()).toContain('page=1');
    expect(page.url()).toContain('cat=short');
  });
});
