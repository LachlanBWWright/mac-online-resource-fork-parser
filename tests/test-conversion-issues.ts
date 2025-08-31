import { test, expect } from '@playwright/test';

test.describe('Conversion Issues Testing', () => {
  test('should test EarthFarm sample loading and check for conversion errors', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Wait for page to load
    await page.waitForSelector('button:has-text("Load EarthFarm Sample")');
    
    // Click Load EarthFarm Sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    
    // Wait for the parsing to complete
    await page.waitForTimeout(3000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-conversion-issues-earthfarm.png', fullPage: true });
    
    // Check if there are any conversion errors
    const conversionErrors = await page.locator('text="Conversion Error:"').count();
    console.log(`Found ${conversionErrors} conversion errors`);
    
    // Get all four-letter codes that are displayed
    const fourLetterCodes = await page.locator('[data-testid="four-letter-code-heading"]').allTextContents();
    console.log('Four-letter codes found:', fourLetterCodes);
    
    // Check how many have valid status
    const validStatuses = await page.locator('text="Successfully parsed"').count();
    console.log(`Found ${validStatuses} successful parses`);
    
    // Search for specific conversion error messages
    const errorTexts = await page.locator('text*="Error: The length of"').allTextContents();
    console.log('Error messages:', errorTexts.slice(0, 5)); // Show first 5 errors
    
    // Check if otto-specs.txt is being loaded correctly
    const ottoSpecs = await page.evaluate(() => {
      return fetch('/test-files/otto-specs.txt')
        .then(response => response.text())
        .then(text => text.split('\n').filter(line => line.trim()));
    });
    console.log('Otto specs loaded:', ottoSpecs);
  });
  
  test('should test manual file upload with otto-specs.txt', async ({ page }) => {
    await page.goto('http://localhost:5174');
    
    // Wait for page to load
    await page.waitForSelector('input[type="file"]');
    
    // Upload the .rsrc file
    const rsrcFile = await page.locator('input[type="file"]').first();
    await rsrcFile.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Upload otto-specs.txt
    await page.click('button:has-text("Specification Management")');
    await page.click('button:has-text("Load Specifications")');
    
    const specFile = await page.locator('input[type="file"]').nth(2);
    await specFile.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Take a screenshot
    await page.screenshot({ path: 'test-conversion-issues-manual.png', fullPage: true });
    
    // Check conversion errors again
    const conversionErrors = await page.locator('text="Conversion Error:"').count();
    console.log(`After manual upload: Found ${conversionErrors} conversion errors`);
  });
});