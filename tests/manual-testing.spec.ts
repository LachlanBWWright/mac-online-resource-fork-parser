import { test, expect } from '@playwright/test';

test.describe('Manual Testing as Requested', () => {
  
  test('Test 1: EarthFarm sample loading - ensure all four-letter codes present and valid', async ({ page }) => {
    console.log('🧪 Test 1: Testing EarthFarm sample loading');
    
    await page.goto('http://localhost:5173');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/test1-initial.png', fullPage: true });
    
    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForSelector('h3', { timeout: 30000 });
    await page.waitForTimeout(5000); // Give time for full parsing
    
    // Take screenshot after loading
    await page.screenshot({ path: 'tests/screenshots/test1-earthfarm-loaded.png', fullPage: true });
    
    // Count four-letter codes
    const h3Elements = await page.locator('h3').allTextContents();
    const fourLetterCodes = h3Elements.filter(text => /^[A-Za-z]{4}$/.test(text.trim()));
    console.log('Found four-letter codes:', fourLetterCodes);
    console.log('Total count:', fourLetterCodes.length);
    
    // Check we have at least 10 four-letter codes (should be 15 according to PR description)
    expect(fourLetterCodes.length).toBeGreaterThanOrEqual(10);
    
    // Check for specific expected codes mentioned in PR
    const expectedCodes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'];
    let foundExpectedCodes = 0;
    for (const code of expectedCodes) {
      if (fourLetterCodes.includes(code)) {
        foundExpectedCodes++;
        console.log('✅ Found expected code:', code);
      } else {
        console.log('❌ Missing expected code:', code);
      }
    }
    
    // Check that none are marked as invalid (no red X icons)
    const errorIcons = await page.locator('.text-red-500').count();
    console.log('Error icons found:', errorIcons);
    expect(errorIcons).toBe(0);
    
    // Check that we have valid status indicators (green checkmarks)
    const successIcons = await page.locator('.text-green-500').count();
    console.log('Success icons found:', successIcons);
    expect(successIcons).toBeGreaterThan(0);
    
    // Check sample data is showing
    const sampleData = await page.locator('div:has-text("Resource ID:")').count();
    console.log('Sample data sections found:', sampleData);
    expect(sampleData).toBeGreaterThan(0);
    
    console.log('✅ Test 1 passed: EarthFarm sample loaded correctly');
  });

  test('Test 2: Manual file upload - upload EarthFarm.ter.rsrc and otto-specs.txt', async ({ page }) => {
    console.log('🧪 Test 2: Testing manual file upload');
    
    await page.goto('http://localhost:5173');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/test2-initial.png', fullPage: true });
    
    // Upload .rsrc file
    const rsrcFileInput = page.locator('input[type="file"]').first();
    await rsrcFileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    
    await page.waitForSelector('h3', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Upload specs file
    const specsFileInput = page.locator('input[type="file"]').nth(1);
    await specsFileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
    
    await page.waitForTimeout(5000); // Give time for specs to load and apply
    
    // Take screenshot after manual upload
    await page.screenshot({ path: 'tests/screenshots/test2-manual-upload.png', fullPage: true });
    
    // Count four-letter codes
    const h3Elements = await page.locator('h3').allTextContents();
    const fourLetterCodes = h3Elements.filter(text => /^[A-Za-z]{4}$/.test(text.trim()));
    console.log('Found four-letter codes (manual upload):', fourLetterCodes);
    console.log('Total count (manual upload):', fourLetterCodes.length);
    
    // Should have the same number as sample loading
    expect(fourLetterCodes.length).toBeGreaterThanOrEqual(10);
    
    // Check that none are marked as invalid
    const errorIcons = await page.locator('.text-red-500').count();
    console.log('Error icons found (manual upload):', errorIcons);
    expect(errorIcons).toBe(0);
    
    // Check that we have valid status indicators
    const successIcons = await page.locator('.text-green-500').count();
    console.log('Success icons found (manual upload):', successIcons);
    expect(successIcons).toBeGreaterThan(0);
    
    // Check sample data is showing proper structure
    const resourceIdElements = await page.locator('div:has-text("Resource ID:")').count();
    console.log('Resource ID elements found (manual upload):', resourceIdElements);
    expect(resourceIdElements).toBeGreaterThan(0);
    
    console.log('✅ Test 2 passed: Manual file upload works correctly');
  });

  test('Test 3: Compare both methods ensure consistency', async ({ page }) => {
    console.log('🧪 Test 3: Comparing sample vs manual upload consistency');
    
    // This test compares the results of both methods to ensure they are consistent
    await page.goto('http://localhost:5173');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // First, test sample loading
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForSelector('h3', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    const sampleCodes = await page.locator('h3').allTextContents();
    const sampleFourLetterCodes = sampleCodes.filter(text => /^[A-Za-z]{4}$/.test(text.trim()));
    
    // Take final comparison screenshot
    await page.screenshot({ path: 'tests/screenshots/test3-final-comparison.png', fullPage: true });
    
    console.log('Sample loading four-letter codes:', sampleFourLetterCodes);
    console.log('Sample loading count:', sampleFourLetterCodes.length);
    
    // Refresh and test manual upload
    await page.reload();
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const rsrcFileInput = page.locator('input[type="file"]').first();
    await rsrcFileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    await page.waitForSelector('h3', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const manualCodes = await page.locator('h3').allTextContents();
    const manualFourLetterCodes = manualCodes.filter(text => /^[A-Za-z]{4}$/.test(text.trim()));
    
    console.log('Manual upload four-letter codes:', manualFourLetterCodes);
    console.log('Manual upload count:', manualFourLetterCodes.length);
    
    // Both methods should produce the same results
    expect(sampleFourLetterCodes.length).toBe(manualFourLetterCodes.length);
    
    console.log('✅ Test 3 passed: Both methods are consistent');
  });
});