import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function takeScreenshotAfterEarthFarmLoad() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create screenshots directory
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click EarthFarm button
    const earthFarmButton = page.locator('button:has-text("Load EarthFarm Sample")');
    await earthFarmButton.click();
    console.log('EarthFarm button clicked');
    
    // Wait for loading
    await page.waitForTimeout(8000);
    
    // Take final screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, 'final-earthfarm-working-state.png'),
      fullPage: true
    });
    
    console.log('✅ Screenshot saved: final-earthfarm-working-state.png');
    
    // Get count of four-letter codes
    const fourLetterCodes = await page.locator('[data-testid^="flc-section-"]').count();
    console.log(`✅ Four-letter code sections found: ${fourLetterCodes}`);
    
  } catch (error) {
    console.error('Error:', error);
  }

  await browser.close();
}

takeScreenshotAfterEarthFarmLoad().catch(console.error);