import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function debugPageLoading() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create screenshots directory
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Listen for console messages and errors
  page.on('console', msg => {
    console.log(`Browser console ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });

  try {
    console.log('Navigating to localhost:5173...');
    await page.goto('http://localhost:5173');
    
    // Wait longer for React to load
    await page.waitForTimeout(5000);
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'current-page-state.png'),
      fullPage: true
    });
    
    console.log('Page loaded, checking content...');
    
    // Check page content
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length || 0);
    console.log('Body text (first 1000 chars):', bodyText?.substring(0, 1000) || 'NO TEXT');
    
    // Check if we can find the main components
    const mainHeading = await page.locator('h1').count();
    console.log('H1 elements found:', mainHeading);
    
    if (mainHeading > 0) {
      const headingText = await page.locator('h1').first().textContent();
      console.log('First heading text:', headingText);
    }
    
    // Check for buttons
    const allButtons = await page.locator('button').count();
    console.log('Total buttons found:', allButtons);
    
    if (allButtons > 0) {
      const buttonTexts = await page.locator('button').allTextContents();
      console.log('Button texts:', buttonTexts);
    }
    
    // Look for EarthFarm specifically
    const earthFarmElements = await page.locator('text=EarthFarm').count();
    console.log('Elements containing "EarthFarm":', earthFarmElements);
    
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ 
      path: path.join(screenshotDir, 'error-state.png'),
      fullPage: true
    });
  }

  await browser.close();
}

debugPageLoading().catch(console.error);