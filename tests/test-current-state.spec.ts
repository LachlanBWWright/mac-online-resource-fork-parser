import { test, expect } from '@playwright/test';
import path from 'path';

test('Check current state of application with EarthFarm sample', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Take screenshot of initial state
  await page.screenshot({ path: 'screenshots/initial-state.png', fullPage: true });
  
  // Click Load EarthFarm Sample button
  await page.click('text=Load EarthFarm Sample');
  
  // Wait for processing to complete
  await page.waitForTimeout(3000);
  
  // Take screenshot after loading sample
  await page.screenshot({ path: 'screenshots/after-earthfarm-sample.png', fullPage: true });
  
  // Get page content
  const pageContent = await page.content();
  
  // Search for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors`);
  
  // Check for error status
  const errorElements = await page.locator('[data-testid*="status"]:has-text("error")').count();
  console.log(`Found ${errorElements} error status elements`);
  
  // Count four-letter code sections
  const fourLetterCodeSections = await page.locator('[data-testid^="four-letter-code-"]').count();
  console.log(`Found ${fourLetterCodeSections} four-letter code sections`);
  
  // Check sample data display
  const sampleDataElements = await page.locator('text=/Sample.*:/').count();
  console.log(`Found ${sampleDataElements} sample data elements`);
  
  // Look for specific error patterns
  if (pageContent.includes('Conversion Error:')) {
    console.log('Found conversion errors in page content');
    // Extract and log conversion error details
    const conversionErrorTexts = await page.locator('text=Conversion Error:').allTextContents();
    console.log('Conversion error details:', conversionErrorTexts);
  }
  
  // Check if four-letter codes are properly displayed
  const fourLetterCodes = await page.locator('[data-testid^="four-letter-code-"]').allTextContents();
  console.log('Four-letter codes found:', fourLetterCodes.length);
  
  // Log the first few four-letter code sections for debugging
  for (let i = 0; i < Math.min(5, fourLetterCodes.length); i++) {
    console.log(`Four-letter code ${i}:`, fourLetterCodes[i].substring(0, 100));
  }
});

test('Check manual upload of EarthFarm.ter.rsrc', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Upload the EarthFarm.ter.rsrc file
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('./public/test-files/EarthFarm.ter.rsrc');
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/manual-upload-earthfarm.png', fullPage: true });
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Manual upload - Found ${conversionErrors} conversion errors`);
  
  // Count four-letter code sections
  const fourLetterCodeSections = await page.locator('[data-testid^="four-letter-code-"]').count();
  console.log(`Manual upload - Found ${fourLetterCodeSections} four-letter code sections`);
});