import { test, expect } from '@playwright/test';

test.describe('Debug Loading Issues', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging
    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    await page.goto('http://localhost:5174');
    await expect(page.locator('h1')).toContainText('Mac Resource Fork Parser');
  });

  test('Test 1: Load EarthFarm sample and check for conversion errors', async ({ page }) => {
    // Click load EarthFarm sample button
    await page.click('button:has-text("Load EarthFarm Sample")');
    
    // Wait for loading to complete
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/test1-earthfarm-loaded.png', fullPage: true });
    
    // Check for any conversion errors on the page
    const conversionErrors = await page.locator('text=Conversion Error:').count();
    console.log(`Found ${conversionErrors} conversion errors on page`);
    
    // Count four-letter code sections
    const fourLetterCodeSections = await page.locator('[data-testid^="four-letter-code-"]').count();
    console.log(`Found ${fourLetterCodeSections} four-letter code sections`);
    
    // Check status indicators
    const validStatuses = await page.locator('text=valid').count();
    const errorStatuses = await page.locator('text=error').count();
    const warningStatuses = await page.locator('text=warning').count();
    console.log(`Status counts - Valid: ${validStatuses}, Error: ${errorStatuses}, Warning: ${warningStatuses}`);
    
    // Look for sample data showing actual field names instead of just numbers
    const sampleDataElements = await page.locator('[data-testid*="sample-data"]').count();
    console.log(`Found ${sampleDataElements} sample data elements`);
    
    // Try to get text content from first few sample data elements
    if (sampleDataElements > 0) {
      for (let i = 0; i < Math.min(3, sampleDataElements); i++) {
        const sampleText = await page.locator('[data-testid*="sample-data"]').nth(i).textContent();
        console.log(`Sample ${i + 1}: ${sampleText?.substring(0, 200)}...`);
      }
    }
    
    // Check for any error messages
    const errorMessages = await page.locator('.text-red-500, .text-destructive').allTextContents();
    console.log(`Error messages found: ${JSON.stringify(errorMessages)}`);
    
    expect(conversionErrors).toBe(0); // Should be no conversion errors
    expect(fourLetterCodeSections).toBeGreaterThan(10); // Should have many four-letter codes
  });

  test('Test 2: Manual upload of EarthFarm.ter.rsrc file', async ({ page }) => {
    // Upload the .rsrc file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/test-files/EarthFarm.ter.rsrc');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/test2-manual-upload.png', fullPage: true });
    
    // Check for conversion errors
    const conversionErrors = await page.locator('text=Conversion Error:').count();
    console.log(`Manual upload - Found ${conversionErrors} conversion errors`);
    
    // Count sections
    const fourLetterCodeSections = await page.locator('[data-testid^="four-letter-code-"]').count();
    console.log(`Manual upload - Found ${fourLetterCodeSections} four-letter code sections`);
    
    expect(conversionErrors).toBe(0);
  });

  test('Test 3: Upload otto-specs.txt and check field initialization', async ({ page }) => {
    // First upload the .rsrc file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/test-files/EarthFarm.ter.rsrc');
    await page.waitForTimeout(2000);
    
    // Then upload the spec file - need to find the spec file input
    // Try to open specification management
    const specManagementButton = page.locator('button:has-text("Specification Management")');
    if (await specManagementButton.isVisible()) {
      await specManagementButton.click();
      await page.waitForTimeout(500);
    }
    
    // Look for load specifications button or input
    const specFileInputs = await page.locator('input[type="file"]').all();
    if (specFileInputs.length > 1) {
      await specFileInputs[1].setInputFiles('public/test-files/otto-specs.txt');
      await page.waitForTimeout(3000);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/test3-with-specs.png', fullPage: true });
    
    // Check if field names have been properly initialized from the spec file
    const fieldNames = await page.locator('input[placeholder*="field"], input[value*="version"], input[value*="numItems"]').count();
    console.log(`Found ${fieldNames} properly initialized field names`);
    
    // Check for conversion errors again
    const conversionErrors = await page.locator('text=Conversion Error:').count();
    console.log(`With specs - Found ${conversionErrors} conversion errors`);
    
    expect(conversionErrors).toBe(0);
  });
});