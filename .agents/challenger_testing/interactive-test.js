const { chromium } = require('playwright');

(async () => {
  console.log('Starting Playwright test...');
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    console.log('Navigating to http://localhost:3000/en');
    await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });

    console.log('Page title:', await page.title());

    // Test routing to gallery
    console.log('Navigating to gallery...');
    await page.goto('http://localhost:3000/en/gallery', { waitUntil: 'networkidle' });
    console.log('Gallery Page title:', await page.title());

    // Check for styles
    const styles = await page.$$('.style-card');
    console.log(`Found ${styles.length} style cards on gallery page.`);

    // Test Admin
    console.log('Navigating to admin...');
    await page.goto('http://localhost:3000/en/admin', { waitUntil: 'networkidle' });
    const text = await page.content();
    if (text.includes('pending_reviews')) {
      console.log('Found pending_reviews in admin page.');
    } else {
      console.log('Did NOT find pending_reviews in admin page.');
    }

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
