import { test, expect } from '@playwright/test';

test('Comprehensive functionality test', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('h1', { timeout: 10000 });
  
  // 1. Check title
  const title = await page.title();
  expect(title).toBe('Resource Fork Parser');
  console.log('✅ Title is correct:', title);
  
  // 2. Check disclaimer is visible
  const disclaimer = await page.locator('text=/work in progress/i').isVisible();
  expect(disclaimer).toBe(true);
  console.log('✅ Disclaimer is visible');
  
  // 3. Load EarthFarm sample
  await page.click('button:has-text("Load EarthFarm Sample")');
  await page.waitForSelector('table', { timeout: 30000 });
  console.log('✅ EarthFarm sample loaded');
  
  // 4. Wait for parsing and check four-letter codes
  await page.waitForTimeout(3000);
  const h3Elements = await page.locator('h3').allTextContents();
  const fourLetterCodes = h3Elements.filter(text => /^[A-Za-z]{4}$/.test(text));
  expect(fourLetterCodes.length).toBeGreaterThan(8);
  console.log('✅ Four-letter codes found:', fourLetterCodes.length);
  
  // 5. Check status indicators are working
  const statusIcons = await page.locator('.text-green-500').count();
  expect(statusIcons).toBeGreaterThan(0);
  console.log('✅ Status indicators working:', statusIcons);
  
  // 6. Check sample data is displayed
  const resourceElements = await page.locator('div:has-text("Resource ID:")').count();
  expect(resourceElements).toBeGreaterThan(0);
  console.log('✅ Sample data displayed:', resourceElements);
  
  // 7. Test array field functionality
  const addArrayButton = page.locator('button:has-text("Add Array Field")').first();
  if (await addArrayButton.isVisible()) {
    await addArrayButton.click();
    await page.waitForTimeout(1000);
    
    // Check array field configuration is visible
    const arrayConfig = await page.locator('.bg-gray-600').first().isVisible();
    expect(arrayConfig).toBe(true);
    console.log('✅ Array field configuration visible');
    
    // Check individual field type dropdowns
    const typeDropdowns = await page.locator('select, [role="combobox"]').count();
    expect(typeDropdowns).toBeGreaterThan(0);
    console.log('✅ Individual type dropdowns working:', typeDropdowns);
  }
  
  // 8. Check JSON download is available
  const jsonDownloadButton = await page.locator('button:has-text("Download as JSON")').isVisible();
  expect(jsonDownloadButton).toBe(true);
  console.log('✅ JSON download button available');
  
  // 9. Check TypeScript download is available
  const tsDownloadButton = await page.locator('button:has-text("Download TypeScript")').isVisible();
  expect(tsDownloadButton).toBe(true);
  console.log('✅ TypeScript download button available');
  
  console.log('🎉 All functionality tests passed!');
});