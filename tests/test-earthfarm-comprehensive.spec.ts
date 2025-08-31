import { test, expect } from '@playwright/test';

test('EarthFarm sample loading test', async ({ page }) => {
  // Listen for console messages and errors
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  console.log('Step 1: Navigate to application');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Wait for React to load
  await page.waitForTimeout(2000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/comprehensive-test-initial.png', fullPage: true });
  
  console.log('Step 2: Verify page loads correctly');
  const title = await page.title();
  expect(title).toBe('Resource Fork Parser');
  
  const heading = await page.locator('h1').textContent();
  expect(heading).toBe('Mac Resource Fork Parser');
  
  console.log('Step 3: Find and click EarthFarm sample button');
  const earthFarmButton = page.locator('button:has-text("Load EarthFarm Sample")');
  await expect(earthFarmButton).toBeVisible();
  
  await earthFarmButton.click();
  console.log('EarthFarm button clicked');
  
  // Wait for loading to complete
  await page.waitForTimeout(5000);
  
  // Take screenshot after loading
  await page.screenshot({ path: 'screenshots/comprehensive-test-after-earthfarm-load.png', fullPage: true });
  
  console.log('Step 4: Check for four-letter code sections');
  const fourLetterCodeSections = page.locator('[data-testid="four-letter-code-section"]');
  const sectionCount = await fourLetterCodeSections.count();
  console.log(`Found ${sectionCount} four-letter code sections`);
  
  // Should have multiple four-letter codes (expecting 15 for EarthFarm)
  expect(sectionCount).toBeGreaterThan(0);
  
  console.log('Step 5: Check for conversion errors');
  const conversionErrors = page.locator('text=/Conversion Error/i');
  const errorCount = await conversionErrors.count();
  console.log(`Found ${errorCount} conversion errors`);
  
  // Take a final screenshot
  await page.screenshot({ path: 'screenshots/comprehensive-test-final.png', fullPage: true });
  
  // Print all console messages for debugging
  console.log('Console messages:', consoleMessages);
  if (pageErrors.length > 0) {
    console.log('Page errors:', pageErrors);
  }
  
  // There should be no conversion errors for a properly loaded EarthFarm sample
  expect(errorCount).toBe(0);
  
  console.log('Test completed successfully');
});