import { test, expect } from '@playwright/test';

test('EarthFarm sample loading functionality test', async ({ page }) => {
  console.log('Step 1: Navigate to application');
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Wait for React to load
  await page.waitForTimeout(2000);
  
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
  await page.waitForTimeout(8000);
  
  console.log('Step 4: Check for four-letter code sections');
  const fourLetterCodeSections = page.locator('[data-testid^="flc-section-"]');
  const sectionCount = await fourLetterCodeSections.count();
  console.log(`Found ${sectionCount} four-letter code sections`);
  
  // Should have multiple four-letter codes (expecting 15 for EarthFarm)
  expect(sectionCount).toBeGreaterThan(0);
  
  console.log('Step 5: Check for conversion errors');
  const conversionErrors = page.locator('text=/Conversion Error/i');
  const errorCount = await conversionErrors.count();
  console.log(`Found ${errorCount} conversion errors`);
  
  console.log('Step 6: Get page text content for analysis');
  const bodyText = await page.textContent('body');
  console.log('Page contains "Conversion Error":', bodyText?.includes('Conversion Error') || false);
  console.log('Page contains four-letter codes (regex check):', /[A-Z]{4}/.test(bodyText || ''));
  
  // Log some of the body text for debugging
  console.log('Body text preview (first 2000 chars):', bodyText?.substring(0, 2000) || 'NO TEXT');
  
  // There should be no conversion errors for a properly loaded EarthFarm sample
  expect(errorCount).toBe(0);
  
  console.log('Test completed successfully - EarthFarm sample loaded without conversion errors');
});