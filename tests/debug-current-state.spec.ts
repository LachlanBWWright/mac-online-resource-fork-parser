import { test, expect } from "@playwright/test";

test("Debug current state - EarthFarm sample loading", async ({ page }) => {
  await page.goto("http://localhost:5173");
  
  // Wait for page to load
  await page.waitForSelector('h1:has-text("Mac Resource Fork Parser")');
  
  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/debug-initial-state.png', fullPage: true });
  
  // Load EarthFarm sample
  await page.click('button:has-text("Load EarthFarm Sample")');
  
  // Wait for processing to complete
  await page.waitForTimeout(3000);
  
  // Take screenshot after loading
  await page.screenshot({ path: 'screenshots/debug-after-earthfarm-load.png', fullPage: true });
  
  // Check for four-letter code sections
  const fourLetterCodeSections = await page.locator('[data-testid^="four-letter-code-"]').count();
  console.log(`Found ${fourLetterCodeSections} four-letter code sections`);
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors`);
  
  // Check for valid status indicators
  const validStatuses = await page.locator('[data-testid="status-icon"]:has(svg.text-green-500)').count();
  console.log(`Found ${validStatuses} valid status indicators`);
  
  // Get all four-letter codes that are displayed
  const fourLetterCodes = await page.locator('[data-testid^="four-letter-code-"]').allTextContents();
  console.log('Four-letter codes found:', fourLetterCodes.map(text => text.substring(0, 4)));
  
  // Check the sample data content
  const sampleDataSections = await page.locator('[data-testid="sample-data"]').count();
  console.log(`Found ${sampleDataSections} sample data sections`);
  
  // Look for specific content in sample data
  if (sampleDataSections > 0) {
    const firstSampleData = await page.locator('[data-testid="sample-data"]').first().textContent();
    console.log('First sample data content:', firstSampleData?.substring(0, 200));
  }
});

test("Debug current state - Manual file upload", async ({ page }) => {
  await page.goto("http://localhost:5173");
  
  // Upload EarthFarm file manually
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('button:has-text("Choose .rsrc File")');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/debug-after-manual-upload.png', fullPage: true });
  
  // Check conversion errors again
  const conversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${conversionErrors} conversion errors after manual upload`);
  
  // Upload otto-specs.txt
  const specFileChooserPromise = page.waitForEvent('filechooser');
  
  // First open the collapsible section
  await page.click('button[data-state="closed"]:has-text("Specification Management")');
  
  await page.click('input[accept=".txt,.json"]');
  const specFileChooser = await specFileChooserPromise;
  await specFileChooser.setFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take final screenshot
  await page.screenshot({ path: 'screenshots/debug-after-spec-upload.png', fullPage: true });
  
  // Check conversion errors after spec upload
  const finalConversionErrors = await page.locator('text=Conversion Error:').count();
  console.log(`Found ${finalConversionErrors} conversion errors after spec upload`);
});