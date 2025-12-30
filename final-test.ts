import { test, expect } from '@playwright/test';

test('Final Test - Fixed EarthFarm Sample', async ({ page }) => {
  await page.goto('http://localhost:4173/mac-online-resource-fork-parser/');
  
  // Wait for the page to load
  await page.waitForSelector('h1:text("Mac Resource Fork Parser")');
  
  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/final-test-initial.png', fullPage: true });
  
  // Click Load EarthFarm Sample button
  await page.click('button:text("Load EarthFarm Sample")');
  
  // Wait for processing to complete
  await page.waitForTimeout(5000);
  
  // Take screenshot after loading sample
  await page.screenshot({ path: 'screenshots/final-test-loaded.png', fullPage: true });
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors after fix`);
  
  // Check for four-letter code sections
  const fourLetterSections = await page.locator('[data-testid^="spec-"]').count();
  console.log(`Found ${fourLetterSections} four-letter code sections after fix`);
  
  // Check status indicators
  const validStatuses = await page.locator('text="✓"').count();
  const errorStatuses = await page.locator('text="✗"').count(); 
  
  console.log(`Status counts after fix - Valid: ${validStatuses}, Error: ${errorStatuses}`);
  
  // We expect significantly fewer or no conversion errors
  expect(conversionErrors).toBeLessThan(10);
});

test('Final Test - Manual Upload', async ({ page }) => {
  await page.goto('http://localhost:4173/mac-online-resource-fork-parser/');
  
  // Upload EarthFarm.ter.rsrc file manually
  const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
  await fileInput.setInputFiles('public/test-files/EarthFarm.ter.rsrc');
  
  // Wait for processing to complete
  await page.waitForTimeout(5000);
  
  // Take screenshot after manual upload
  await page.screenshot({ path: 'screenshots/final-test-manual-upload.png', fullPage: true });
  
  // Upload specifications
  await page.click('button:text("Specification Management")');
  await page.waitForTimeout(1000);
  
  const specFileInput = page.locator('input[type="file"][accept=".txt"]');
  await specFileInput.setInputFiles('public/test-files/otto-specs.txt');
  
  // Wait for spec loading to complete
  await page.waitForTimeout(3000);
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/final-test-with-specs.png', fullPage: true });
  
  // Check final state
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Manual upload with specs - Found ${conversionErrors} conversion errors`);
  
  const fourLetterSections = await page.locator('[data-testid^="spec-"]').count();
  console.log(`Manual upload with specs - Found ${fourLetterSections} four-letter code sections`);
});