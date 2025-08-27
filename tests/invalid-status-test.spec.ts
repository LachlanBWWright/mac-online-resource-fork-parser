import { test, expect } from '@playwright/test';

test('Test changing data type to create invalid status', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  
  // Click the Load EarthFarm Sample button
  console.log('Loading EarthFarm sample...');
  await page.click('button:has-text("Load EarthFarm Sample")');
  await page.waitForTimeout(5000);
  
  // Find dropdowns
  const dropdowns = page.locator('select');
  const dropdownCount = await dropdowns.count();
  console.log(`Found ${dropdownCount} dropdowns`);
  
  if (dropdownCount > 0) {
    // Take screenshot before change
    await page.screenshot({ path: 'screenshots/manual-test-before-change.png', fullPage: true });
    
    // Try changing different data types to create invalid status
    console.log('Changing first dropdown to incompatible type...');
    
    // Try changing to 'double' (8 bytes) which might be incompatible
    await dropdowns.first().selectOption('double');
    await page.waitForTimeout(3000);
    
    // Check for invalid status
    let invalidCount = await page.locator('.text-red-500').count();
    console.log(`Invalid statuses after double change: ${invalidCount}`);
    
    if (invalidCount === 0) {
      // Try char (1 byte) which is very likely to be incompatible
      console.log('Trying char instead...');
      await dropdowns.first().selectOption('char');
      await page.waitForTimeout(2000);
      invalidCount = await page.locator('.text-red-500').count();
      console.log(`Invalid statuses after char change: ${invalidCount}`);
    }
    
    // Take screenshot after change
    await page.screenshot({ path: 'screenshots/manual-test-after-change.png', fullPage: true });
    
    if (invalidCount > 0) {
      console.log('✅ Successfully created invalid status!');
    } else {
      console.log('⚠️ No invalid status created - all types may be compatible');
    }
  }
});