import { test, expect } from '@playwright/test';

test('Debug Current State - EarthFarm Sample Loading', async ({ page }) => {
  await page.goto('http://localhost:4173/mac-online-resource-fork-parser/');
  
  // Wait for the page to load
  await page.waitForSelector('h1:text("Mac Resource Fork Parser")');
  
  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/debug-initial-state.png', fullPage: true });
  
  // Click Load EarthFarm Sample button
  await page.click('button:text("Load EarthFarm Sample")');
  
  // Wait for processing to complete (wait for the processing indicator to disappear)
  await page.waitForTimeout(3000);
  
  // Take screenshot after loading sample
  await page.screenshot({ path: 'screenshots/debug-after-earthfarm-load.png', fullPage: true });
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors`);
  
  // Check for four-letter code sections
  const fourLetterSections = await page.locator('[data-testid^="spec-"]').count();
  console.log(`Found ${fourLetterSections} four-letter code sections`);
  
  // Get all four-letter codes found
  const fourLetterCodes = await page.locator('[data-testid^="spec-"]').all();
  console.log(`Four-letter codes found: ${fourLetterCodes.length}`);
  
  for (let i = 0; i < fourLetterCodes.length; i++) {
    const codeElement = fourLetterCodes[i];
    const codeText = await codeElement.getAttribute('data-testid');
    console.log(`Four-letter code ${i + 1}: ${codeText}`);
  }
  
  // Check status indicators
  const validStatuses = await page.locator('text="✓"').count();
  const errorStatuses = await page.locator('text="✗"').count(); 
  const warningStatuses = await page.locator('text="⚠"').count();
  
  console.log(`Status counts - Valid: ${validStatuses}, Error: ${errorStatuses}, Warning: ${warningStatuses}`);
  
  // Read the page content to look for conversion errors
  const pageContent = await page.content();
  const hasConversionErrors = pageContent.includes('Conversion Error:');
  console.log(`Page contains conversion errors: ${hasConversionErrors}`);
  
  // Get the text content to analyze
  const textContent = await page.locator('body').textContent();
  if (textContent && textContent.includes('Conversion Error:')) {
    const errorLines = textContent.split('\n').filter(line => line.includes('Conversion Error:'));
    console.log('Conversion error details:', errorLines);
  }
});

test('Debug Current State - Manual File Upload', async ({ page }) => {
  await page.goto('http://localhost:4173/mac-online-resource-fork-parser/');
  
  // Wait for the page to load
  await page.waitForSelector('h1:text("Mac Resource Fork Parser")');
  
  // Upload EarthFarm.ter.rsrc file manually
  const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
  await fileInput.setInputFiles('public/test-files/EarthFarm.ter.rsrc');
  
  // Wait for processing to complete
  await page.waitForTimeout(3000);
  
  // Take screenshot after manual upload
  await page.screenshot({ path: 'screenshots/debug-after-manual-upload.png', fullPage: true });
  
  // Check for conversion errors after manual upload
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Manual upload - Found ${conversionErrors} conversion errors`);
  
  // Check four-letter code sections after manual upload
  const fourLetterSections = await page.locator('[data-testid^="spec-"]').count();
  console.log(`Manual upload - Found ${fourLetterSections} four-letter code sections`);
  
  // Now upload specification file if available
  try {
    await page.click('button:text("Specification Management")');
    await page.waitForTimeout(1000);
    
    const specFileInput = page.locator('input[type="file"][accept=".txt"]');
    await specFileInput.setInputFiles('public/test-files/otto-specs.txt');
    
    // Wait for spec loading to complete
    await page.waitForTimeout(3000);
    
    // Take screenshot after spec upload
    await page.screenshot({ path: 'screenshots/debug-after-spec-upload.png', fullPage: true });
    
    // Check again for conversion errors
    const postSpecErrors = await page.locator('text=Conversion Error:').count();
    console.log(`After spec upload - Found ${postSpecErrors} conversion errors`);
    
  } catch (error) {
    console.log('Could not upload specification file:', error);
  }
});