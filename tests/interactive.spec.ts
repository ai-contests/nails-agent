import { test, expect } from '@playwright/test';

test.describe('Frontend Gap Analysis Interactive Tests', () => {
  test('1.1 Homepage Trending Styles - Check if dynamic data is fetched or hardcoded', async ({ page }) => {
    // Intercept API requests
    const apiRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });

    await page.goto('http://localhost:3000/en');
    
    // Wait for network idle or a short timeout
    await page.waitForTimeout(2000);

    // Verify if it fetched recommendation snapshots
    const hasRecommendationApi = apiRequests.some(url => url.includes('/api/recommendations/main'));
    expect(hasRecommendationApi, 'Should call /api/recommendations/main').toBeFalsy(); // It's a gap! It should call it but we know it doesn't.
    
    // Check if DOM contains hardcoded styles
    const html = await page.content();
    expect(html).toContain('STYLE001');
    expect(html).toContain('STYLE002');
    expect(html).toContain('STYLE003');
  });

  test('1.2 Gallery Page - API endpoint and rendering', async ({ page }) => {
    let calledWrongApi = false;
    let calledCorrectApi = false;

    page.on('request', request => {
      if (request.url().includes('/api/recommendations/main')) {
        calledWrongApi = true;
      }
      if (request.url().includes('/api/styles')) {
        calledCorrectApi = true;
      }
    });

    await page.goto('http://localhost:3000/en/gallery');
    await page.waitForTimeout(2000);

    expect(calledWrongApi, 'Incorrectly calls recommendations API').toBeTruthy();
    expect(calledCorrectApi, 'Missing styles API').toBeFalsy();
  });

  test('1.3 & 2.1 Admin Dashboard - Missing features', async ({ page }) => {
    await page.goto('http://localhost:3000/en/admin');
    await page.waitForTimeout(2000);

    const html = await page.content();
    
    // The text 'strategy memories' might appear inside the Findings section as a generic paragraph,
    // but there should be NO dedicated heading (<h2> or <h3>) for "Strategy Memories" or "Pending Reviews"
    // as required by the PRD for the independent modules.
    const hasPendingReviewsHeading = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4')).some(el => el.textContent?.toLowerCase().includes('pending reviews'));
    });
    const hasStrategyMemoriesHeading = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4')).some(el => el.textContent?.toLowerCase().includes('strategy memories'));
    });

    expect(hasPendingReviewsHeading, 'Should not have a dedicated Pending Reviews section').toBeFalsy();
    expect(hasStrategyMemoriesHeading, 'Should not have a dedicated Strategy Memories section').toBeFalsy();

    // Check for canvas or charts
    expect(html).not.toContain('<canvas');
    const hasCharts = await page.evaluate(() => {
      return document.querySelectorAll('canvas, svg.recharts-surface').length > 0;
    });
    expect(hasCharts).toBeFalsy();
  });
});
