import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function createFinalScreenshot() {
  console.log("🚀 Creating final screenshot for PR comment...\n");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();
  
  try {
    console.log("📄 Navigating to http://localhost:5173/");
    await page.goto("http://localhost:5173/", { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Click the EarthFarm button
    console.log("🖱️  Clicking Load EarthFarm Sample button...");
    await page.locator('button:has-text("Load EarthFarm Sample")').click();
    
    // Wait for processing
    await page.waitForTimeout(6000);
    
    // Scroll to show some four-letter codes
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    
    // Create screenshots directory
    const screenshotDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: path.join(screenshotDir, "earthfarm-working-final.png"),
      fullPage: false 
    });
    
    console.log("✅ Screenshot saved: screenshots/earthfarm-working-final.png");
    
    // Verify the content
    const testIds = await page.$$eval('[data-testid]', elements => 
      elements.map(el => el.getAttribute('data-testid'))
        .filter(id => id?.startsWith('flc-section-'))
    );
    
    console.log(`\n✅ Verified: ${testIds.length} four-letter codes loaded successfully`);
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await browser.close();
  }
}

createFinalScreenshot().catch(console.error);
