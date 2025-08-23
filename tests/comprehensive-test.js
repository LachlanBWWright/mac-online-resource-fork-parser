import { chromium } from 'playwright';

async function comprehensiveTest() {
  console.log('Starting comprehensive test...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('1. Loading the application...');
    await page.goto('http://localhost:5173');
    await page.waitForSelector('h1');
    await page.screenshot({ path: 'tests/screenshots/01-app-loaded.png', fullPage: true });
    
    console.log('2. Checking UI elements...');
    // Check main sections are visible
    await page.waitForSelector('h2:has-text("File Operations")');
    await page.waitForSelector('h2:has-text("Custom Struct Specs")');
    await page.waitForSelector('h2:has-text("Settings")');
    await page.screenshot({ path: 'tests/screenshots/02-ui-sections.png', fullPage: true });
    
    console.log('3. Adding a custom spec...');
    await page.click('button:has-text("Add Spec")');
    await page.screenshot({ path: 'tests/screenshots/03-add-custom-spec.png', fullPage: true });
    
    // Fill in custom spec
    const newSpec = page.locator('.border.border-gray-200').last();
    await newSpec.locator('input[placeholder="e.g. Hedr"]').fill('TEST');
    await newSpec.locator('input[placeholder="e.g. L5i3f5i40x"]').fill('H2i');
    await newSpec.locator('input[placeholder="e.g. version,numItems,width,height"]').fill('field1,field2,field3');
    await page.screenshot({ path: 'tests/screenshots/04-custom-spec-filled.png', fullPage: true });
    
    console.log('4. Testing Otto specs toggle...');
    await page.uncheck('input[type="checkbox"]');
    await page.screenshot({ path: 'tests/screenshots/05-otto-specs-disabled.png', fullPage: true });
    
    await page.check('input[type="checkbox"]');
    await page.screenshot({ path: 'tests/screenshots/06-otto-specs-enabled.png', fullPage: true });
    
    console.log('5. Loading sample file...');
    await page.click('button:has-text("Load Sample File")');
    
    // Wait for processing with timeout
    try {
      await page.waitForSelector('.bg-green-50', { timeout: 30000 });
      console.log('Sample file loaded successfully!');
      await page.screenshot({ path: 'tests/screenshots/07-sample-loaded-success.png', fullPage: true });
      
      // Test download button
      console.log('6. Testing JSON download...');
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Download JSON")');
      const download = await downloadPromise;
      console.log(`Downloaded: ${download.suggestedFilename()}`);
      await page.screenshot({ path: 'tests/screenshots/08-json-download-success.png', fullPage: true });
      
    } catch (error) {
      console.log('Sample file loading failed, taking error screenshot...');
      await page.screenshot({ path: 'tests/screenshots/07-sample-load-error.png', fullPage: true });
      
      // Check if there's an error message
      const errorElement = page.locator('.bg-red-50');
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        console.log('Error message:', errorText);
      }
    }
    
    console.log('7. Taking final full page screenshot...');
    await page.screenshot({ path: 'tests/screenshots/09-final-state.png', fullPage: true });
    
    console.log('Comprehensive test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'tests/screenshots/error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

comprehensiveTest();