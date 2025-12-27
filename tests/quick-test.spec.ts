import { test, expect } from '@playwright/test';

test('EarthFarm sample loads successfully', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Click the Load EarthFarm Sample button
  await page.click('text=Load EarthFarm Sample');
  
  // Wait for parsing to complete
  await page.waitForTimeout(5000);
  
  // Check if four-letter codes are visible
  const fourLetterCodes = await page.$$('[data-testid="four-letter-code-section"]');
  console.log(`Found ${fourLetterCodes.length} four-letter codes`);
  
  // Take a screenshot
  await page.screenshot({ path: 'screenshots/quick-earthfarm-test.png', fullPage: true });
  
  // Check for errors on the page
  const errorText = await page.textContent('body');
  expect(errorText).not.toContain('Failed to parse');
  
  // Verify we have at least some four-letter codes
  expect(fourLetterCodes.length).toBeGreaterThan(0);
});
