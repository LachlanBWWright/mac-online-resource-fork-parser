import { chromium } from 'playwright';

async function debugWithConsole() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.text()}`);
  });
  
  // Capture errors
  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
  });
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Debugging with Console Logs ===');
    
    // Load EarthFarm Sample
    console.log('Clicking EarthFarm sample button...');
    await page.click('button:has-text("Load EarthFarm Sample")');
    
    // Wait and check the state
    await page.waitForTimeout(5000);
    
    // Inject JavaScript to check React state
    const stateInfo = await page.evaluate(() => {
      // Try to find React fiber to access state
      const reactRoot = document.querySelector('#root');
      if (reactRoot && (reactRoot as any)._reactInternalFiber) {
        return 'React fiber found (old)';
      } else if (reactRoot && (reactRoot as any)._reactInternalInstance) {
        return 'React instance found (old)';
      } else {
        return 'No React state access available';
      }
    });
    
    console.log(`React state access: ${stateInfo}`);
    
    // Check for specific error patterns
    const networkRequests = await page.evaluate(() => {
      return window.performance.getEntriesByType('resource').map(entry => ({
        name: entry.name,
        responseEnd: entry.responseEnd,
        transferSize: (entry as any).transferSize
      }));
    });
    
    console.log('\nNetwork requests:');
    networkRequests.forEach(req => {
      if (req.name.includes('EarthFarm') || req.name.includes('otto-specs')) {
        console.log(`  ${req.name} - Size: ${req.transferSize}, Time: ${req.responseEnd}`);
      }
    });
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/debug-with-console.png', fullPage: true });
    
  } catch (error) {
    console.error('Error during console debugging:', error);
  } finally {
    await browser.close();
  }
}

debugWithConsole().catch(console.error);