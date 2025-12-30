import { chromium } from 'playwright';

async function finalTest() {
  console.log('Testing enhanced version...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await page.goto('http://localhost:5173');
    await page.waitForSelector('h1');
    
    // Add a custom spec to test validation
    await page.click('button:has-text("Add Spec")');
    const newSpec = page.locator('.border.border-gray-200').last();
    await newSpec.locator('input[placeholder="e.g. Hedr"]').fill('DEMO');
    
    // Test invalid spec first
    await newSpec.locator('input[placeholder="e.g. L5i3f5i40x"]').fill('INVALID@#$');
    await page.screenshot({ path: 'tests/screenshots/10-validation-error.png', fullPage: true });
    
    // Fix the spec
    await newSpec.locator('input[placeholder="e.g. L5i3f5i40x"]').fill('L2H4f');
    await newSpec.locator('input[placeholder="e.g. version,numItems,width,height"]').fill('size,count1,count2,values');
    
    // Load sample file to test everything works
    await page.click('button:has-text("Load Sample File")');
    await page.waitForSelector('.bg-green-50', { timeout: 30000 });
    
    await page.screenshot({ path: 'tests/screenshots/11-enhanced-final.png', fullPage: true });
    
    console.log('Enhanced version test completed successfully!');
    
  } catch (error) {
    console.error('Enhanced test failed:', error);
  } finally {
    await browser.close();
  }
}

finalTest();