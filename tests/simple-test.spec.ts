import { test, expect } from '@playwright/test';

test('Test array fields and sample data', async ({ page }) => {
  // Start the dev server
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForSelector('h1', { timeout: 10000 });
  console.log('Page loaded');
  
  // Load EarthFarm sample
  await page.click('button:has-text("Load EarthFarm Sample")');
  console.log('Clicked Load EarthFarm Sample');
  
  // Wait for data to load
  await page.waitForSelector('table', { timeout: 30000 });
  console.log('Table loaded');
  
  // Check if four-letter codes are loaded
  const codeHeaders = await page.locator('h3').allTextContents();
  console.log('Four-letter codes found:', codeHeaders);
  
  // Find first Add Array Field button
  const addArrayButton = page.locator('button:has-text("Add Array Field")').first();
  if (await addArrayButton.isVisible()) {
    console.log('Add Array Field button found, clicking...');
    await addArrayButton.click();
    await page.waitForTimeout(2000); // Wait for UI update
    
    // Check if array field configuration is visible
    const arrayConfig = await page.locator('.bg-gray-700').first();
    if (await arrayConfig.isVisible()) {
      console.log('Array field configuration is visible');
    }
  }
  
  // Check sample data display
  const statusIndicators = await page.locator('span').filter({ hasText: /✓|✗|⚠/ }).count();
  console.log('Status indicators found:', statusIndicators);
  
  // Check if sample data is shown
  const sampleDataElements = await page.locator('div').filter({ hasText: /Resource/ }).count();
  console.log('Sample data elements found:', sampleDataElements);
  
  console.log('Test completed successfully');
});