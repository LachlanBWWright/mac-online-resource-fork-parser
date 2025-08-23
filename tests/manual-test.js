import { chromium } from 'playwright';

async function test() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173');
    
    console.log('Waiting for page to load...');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'tests/screenshots/manual-test-initial.png', fullPage: true });
    
    console.log('Checking if sample file button exists...');
    const sampleButton = await page.locator('button:has-text("Load Sample File")');
    if (await sampleButton.count() > 0) {
      console.log('Sample button found, clicking...');
      await sampleButton.click();
      
      console.log('Waiting for processing...');
      await page.waitForSelector('.bg-green-50', { timeout: 30000 });
      
      console.log('Taking success screenshot...');
      await page.screenshot({ path: 'tests/screenshots/manual-test-success.png', fullPage: true });
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

test();