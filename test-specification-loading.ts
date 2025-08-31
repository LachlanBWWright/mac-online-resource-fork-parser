import { test, expect } from '@playwright/test';
import { join } from 'path';

test('Test EarthFarm sample loading and specification uploading', async ({ page }) => {
  // Start dev server
  await page.goto('http://localhost:5173');
  
  console.log('Page title:', await page.title());
  
  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/initial-page.png', fullPage: true });
  
  // Test 1: Load EarthFarm Sample
  console.log('Testing EarthFarm sample loading...');
  await page.click('button:has-text("Load EarthFarm Sample")');
  
  // Wait for loading to complete
  await page.waitForTimeout(3000);
  
  // Take screenshot after loading sample
  await page.screenshot({ path: 'screenshots/earthfarm-sample-loaded.png', fullPage: true });
  
  // Count four-letter codes
  const fourLetterCodes = await page.locator('[data-testid="four-letter-code"]').count();
  console.log(`Found ${fourLetterCodes} four-letter codes`);
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors`);
  
  // Get all four-letter code names
  const codeNames = await page.locator('[data-testid="four-letter-code"] h3').allTextContents();
  console.log('Four-letter codes found:', codeNames);
  
  // Check status indicators
  const validStatuses = await page.locator('text=Valid').count();
  const errorStatuses = await page.locator('text=Error').count();
  const warningStatuses = await page.locator('text=Warning').count();
  console.log(`Status counts - Valid: ${validStatuses}, Error: ${errorStatuses}, Warning: ${warningStatuses}`);
  
  // Test 2: Try to upload otto-specs.txt
  console.log('Testing specification file upload...');
  
  // Click on Specification Management to expand it
  await page.click('button:has-text("Specification Management")');
  await page.waitForTimeout(1000);
  
  // Try to upload otto-specs.txt
  const fileInput = page.locator('input[type="file"][accept=".txt"]');
  const filePath = join(process.cwd(), 'public', 'test-files', 'otto-specs.txt');
  await fileInput.setInputFiles(filePath);
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take screenshot after spec upload
  await page.screenshot({ path: 'screenshots/after-spec-upload.png', fullPage: true });
  
  // Check for conversion errors again
  const conversionErrorsAfterSpec = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrorsAfterSpec} conversion errors after spec upload`);
  
  // Check status indicators again
  const validStatusesAfterSpec = await page.locator('text=Valid').count();
  const errorStatusesAfterSpec = await page.locator('text=Error').count();
  console.log(`Status counts after spec - Valid: ${validStatusesAfterSpec}, Error: ${errorStatusesAfterSpec}`);
  
  // Test 3: Manual file upload
  console.log('Testing manual EarthFarm.ter.rsrc upload...');
  
  // Reset by reloading page
  await page.reload();
  await page.waitForTimeout(2000);
  
  // Upload EarthFarm.ter.rsrc file manually
  const rsrcFileInput = page.locator('input[type="file"][accept=".rsrc"]');
  const rsrcFilePath = join(process.cwd(), 'public', 'test-files', 'EarthFarm.ter.rsrc');
  await rsrcFileInput.setInputFiles(rsrcFilePath);
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take screenshot after manual upload
  await page.screenshot({ path: 'screenshots/manual-rsrc-upload.png', fullPage: true });
  
  // Count four-letter codes again
  const fourLetterCodesManual = await page.locator('[data-testid="four-letter-code"]').count();
  console.log(`Found ${fourLetterCodesManual} four-letter codes after manual upload`);
  
  // Check for conversion errors
  const conversionErrorsManual = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrorsManual} conversion errors after manual upload`);
  
  // Now upload otto-specs.txt after manual upload
  await page.click('button:has-text("Specification Management")');
  await page.waitForTimeout(1000);
  
  const specFileInput = page.locator('input[type="file"][accept=".txt"]');
  await specFileInput.setInputFiles(filePath);
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/manual-upload-with-specs.png', fullPage: true });
  
  // Final check for conversion errors
  const finalConversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${finalConversionErrors} conversion errors after manual upload with specs`);
  
  // Summary
  console.log('=== SUMMARY ===');
  console.log(`EarthFarm sample: ${fourLetterCodes} codes, ${conversionErrors} errors`);
  console.log(`After spec upload: ${conversionErrorsAfterSpec} errors`);
  console.log(`Manual upload: ${fourLetterCodesManual} codes, ${conversionErrorsManual} errors`);
  console.log(`Manual + specs: ${finalConversionErrors} errors`);
});