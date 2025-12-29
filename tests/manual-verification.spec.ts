import { test } from '@playwright/test';

test('Manual verification - take screenshot of loaded EarthFarm', async ({ page }) => {
  await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');
  await page.waitForLoadState('networkidle');
  
  // Click the EarthFarm sample button
  await page.click('text=Load EarthFarm Sample');
  
  // Wait for processing
  await page.waitForTimeout(3000);
  
  // Take screenshot of overview
  await page.screenshot({ path: 'screenshots/upgrade-v1.0.5-overview.png', fullPage: true });
  console.log('✓ Screenshot saved: upgrade-v1.0.5-overview.png');
  
  // Scroll to Hedr and take screenshot
  await page.locator('h3:text("Hedr")').scrollIntoViewIfNeeded();
  await page.locator('h3:text("Hedr")').screenshot({ path: 'screenshots/upgrade-v1.0.5-hedr-detail.png' });
  console.log('✓ Screenshot saved: upgrade-v1.0.5-hedr-detail.png');
  
  // Scroll to Liqd (complex array field) and take screenshot
  await page.locator('h3:text("Liqd")').scrollIntoViewIfNeeded();
  await page.locator('h3:text("Liqd")').screenshot({ path: 'screenshots/upgrade-v1.0.5-liqd-array.png' });
  console.log('✓ Screenshot saved: upgrade-v1.0.5-liqd-array.png');
  
  // Get page text to check for field names
  const pageText = await page.textContent('body');
  
  // Check for Hedr field names
  const hedrFields = ['version', 'numItems', 'mapWidth', 'mapHeight'];
  console.log('\n=== Checking Hedr field names ===');
  for (const field of hedrFields) {
    if (pageText?.includes(field)) {
      console.log(`✓ Found field: ${field}`);
    } else {
      console.log(`✗ Missing field: ${field}`);
    }
  }
  
  // Check for Liqd array field names
  const liqdFields = ['x_0', 'y_0', 'hotSpotX', 'hotSpotZ'];
  console.log('\n=== Checking Liqd field names ===');
  for (const field of liqdFields) {
    if (pageText?.includes(field)) {
      console.log(`✓ Found field: ${field}`);
    } else {
      console.log(`✗ Missing field: ${field}`);
    }
  }
  
  // Check for conversion errors
  if (pageText?.includes('Conversion Error')) {
    console.log('\n✗ Found conversion errors!');
  } else {
    console.log('\n✓ No conversion errors found');
  }
});
