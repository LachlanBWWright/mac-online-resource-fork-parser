import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function debugEarthFarmLoading() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create screenshots directory
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    console.log('Navigating to localhost:5173...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'initial-page-state.png'),
      fullPage: true
    });
    
    console.log('Page loaded, taking initial screenshot...');
    
    // Get page content and check what's there
    const pageContent = await page.content();
    console.log('Page HTML length:', pageContent.length);
    console.log('Page title:', await page.title());
    
    // Check for any obvious issues
    const bodyText = await page.textContent('body');
    console.log('Body text preview:', bodyText?.substring(0, 500));
    
    // Check if React is loading
    const reactRoot = await page.locator('#root').count();
    console.log('React root element found:', reactRoot > 0);
    
    // Check for EarthFarm button with different selectors
    const buttonVariations = [
      'button:has-text("Load EarthFarm Sample")',
      'button[class*="button"]:has-text("EarthFarm")', 
      'text="Load EarthFarm Sample"',
      '*:has-text("EarthFarm")'
    ];
    
    for (const selector of buttonVariations) {
      const count = await page.locator(selector).count();
      console.log(`Selector "${selector}" found: ${count} elements`);
    }
    
    if (buttonExists > 0) {
      console.log('Clicking EarthFarm sample button...');
      
    // Listen for console messages and network requests
    page.on('console', msg => {
      console.log(`Browser console ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('response', response => {
      console.log(`Network response: ${response.status()} ${response.url()}`);
    });
    
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
      
      // Click the button
      await earthFarmButton.click();
      
      // Wait a bit for any loading to happen
      await page.waitForTimeout(3000);
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: path.join(screenshotDir, 'after-earthfarm-click.png'),
        fullPage: true
      });
      
      // Check for any error messages on the page
      const errorElements = await page.locator('text=/error|Error|ERROR/i').count();
      console.log(`Error elements found: ${errorElements}`);
      
      // Check for four-letter code sections
      const fourLetterSections = await page.locator('[data-testid="four-letter-code-section"]').count();
      console.log(`Four-letter code sections: ${fourLetterSections}`);
      
      // Check for conversion errors specifically
      const conversionErrors = await page.locator('text=/Conversion Error/i').count();
      console.log(`Conversion errors found: ${conversionErrors}`);
      
      // Get the full text content of the page to analyze
      const pageText = await page.textContent('body');
      console.log('Page contains "Conversion Error":', pageText?.includes('Conversion Error'));
      console.log('Page contains four-letter codes:', /[A-Z]{4}/.test(pageText || ''));
      
      // Check specifically for the four-letter code specifications section
      const specificationsSection = await page.locator('text="Four-Letter Code Specifications"').count();
      console.log(`Specifications section found: ${specificationsSection}`);
      
      // Look for any toast notifications
      const toasts = await page.locator('[data-toast]').count();
      console.log(`Toast notifications: ${toasts}`);
      
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-state.png'),
      fullPage: true
    });
  }

  await browser.close();
}

debugEarthFarmLoading().catch(console.error);