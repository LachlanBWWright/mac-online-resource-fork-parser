import { chromium } from 'playwright';

async function testFinalCheck() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('=== Testing EarthFarm Sample Loading ===');
    
    // Click the Load EarthFarm Sample button
    await page.click('text=Load EarthFarm Sample');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: '/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/screenshots/final-test-success.png' });
    
    // Check for conversion errors
    const content = await page.textContent('body');
    const hasConversionErrors = content?.includes('Conversion Error:') || content?.includes('conversion_error');
    
    if (!hasConversionErrors) {
      console.log('✅ SUCCESS: No conversion errors found!');
      
      // Count loaded sections
      const sections = await page.locator('[data-testid^="flc-section-"]').count();
      console.log(`✅ Found ${sections} four-letter code sections`);
      
      // Count valid sections
      const validSections = await page.locator('text=Successfully parsed').count();
      console.log(`✅ Found ${validSections} valid sections`);
      
      console.log('✅ The fix is working correctly!');
    } else {
      console.log('❌ FAILURE: Still has conversion errors');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testFinalCheck();