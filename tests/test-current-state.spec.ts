import { test, expect } from '@playwright/test';

test('Test current implementation', async ({ page }) => {
  // Start the dev server
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForSelector('h1', { timeout: 10000 });
  
  // Take a screenshot
  await page.screenshot({ path: 'screenshots/current-state.png', fullPage: true });
  
  // Test loading EarthFarm sample
  await page.click('button:has-text("Load EarthFarm Sample")');
  
  // Wait for data to load
  await page.waitForSelector('table', { timeout: 10000 });
  
  // Take another screenshot
  await page.screenshot({ path: 'screenshots/earthfarm-loaded.png', fullPage: true });
  
  // Check if four-letter codes are loaded
  const codes = await page.locator('h3').allTextContents();
  console.log('Four-letter codes found:', codes);
  
  // Test array field functionality
  if (codes.length > 0) {
    // Find the first Add Array Field button
    const addArrayButton = page.locator('button:has-text("Add Array Field")').first();
    if (await addArrayButton.isVisible()) {
      await addArrayButton.click();
      await page.waitForTimeout(1000); // Wait for UI update
      await page.screenshot({ path: 'screenshots/array-field-added.png', fullPage: true });
    }
  }
  
  console.log('Test completed successfully');
});