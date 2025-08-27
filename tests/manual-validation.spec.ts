import { test, expect } from '@playwright/test';

test.describe('EarthFarm Testing as Requested', () => {
  test('Test by clicking Load EarthFarm Sample and examining page content', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/manual-test-initial.png', fullPage: true });
    
    // Click the Load EarthFarm Sample button
    console.log('Clicking Load EarthFarm Sample button...');
    await page.click('button:has-text("Load EarthFarm Sample")');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
    // Take screenshot after loading
    await page.screenshot({ path: 'screenshots/manual-test-after-load.png', fullPage: true });
    
    // Count four-letter codes
    const fourLetterCodeSections = await page.locator('[data-testid^="flc-section-"]');
    const count = await fourLetterCodeSections.count();
    console.log(`Found ${count} four-letter code sections`);
    
    // Get all four-letter code names
    const codeNames = await page.locator('[data-testid^="flc-section-"] h3').allTextContents();
    console.log('Four-letter codes found:', codeNames);
    
    // Look for status information
    const validStatuses = await page.locator('.text-green-500').count();
    const invalidStatuses = await page.locator('.text-red-500').count();
    console.log(`Status indicators - Valid: ${validStatuses}, Invalid: ${invalidStatuses}`);
    
    // Check for any sample data displays
    const sampleDataContainers = await page.locator('pre').count();
    console.log(`Sample data containers (pre elements): ${sampleDataContainers}`);
    
    // Print page text content to see what's actually there
    const bodyText = await page.locator('body').textContent();
    console.log('Page content snippet:', bodyText?.substring(0, 500) + '...');
    
    expect(count).toBeGreaterThan(0);
  });

  test('Test by manually uploading files', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Upload .rsrc file
    console.log('Uploading .rsrc file...');
    const rsrcInput = page.locator('input[type="file"]').first();
    await rsrcInput.setInputFiles('./public/test-files/EarthFarm.ter.rsrc');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Take screenshot after rsrc upload
    await page.screenshot({ path: 'screenshots/manual-test-rsrc-only.png', fullPage: true });
    
    // Count four-letter codes
    const fourLetterCodeSections = await page.locator('[data-testid^="flc-section-"]');
    const count = await fourLetterCodeSections.count();
    console.log(`Found ${count} four-letter code sections after rsrc upload`);
    
    // Get all four-letter code names
    const codeNames = await page.locator('[data-testid^="flc-section-"] h3').allTextContents();
    console.log('Four-letter codes after rsrc upload:', codeNames);
    
    expect(count).toBeGreaterThan(0);
  });
});