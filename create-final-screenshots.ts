import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";

async function createFinalScreenshots() {
  console.log("📸 Creating final proof screenshots...\n");
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1600, height: 1200 }
  });
  const page = await context.newPage();
  
  try {
    const screenshotDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    console.log("Loading EarthFarm Sample...");
    await page.goto("http://localhost:5173/", { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("Load EarthFarm Sample")').click();
    await page.waitForTimeout(10000);
    
    // Screenshot 1: Liqd with array field
    console.log("1. Liqd section with array field...");
    const liqdSection = page.locator('[data-testid="flc-section-Liqd"]');
    await liqdSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotDir, "final-fix-01-liqd-array.png"),
      fullPage: false 
    });
    
    // Screenshot 2: STgd section
    console.log("2. STgd section (x? handling)...");
    const stgdSection = page.locator('[data-testid="flc-section-STgd"]');
    await stgdSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotDir, "final-fix-02-stgd.png"),
      fullPage: false 
    });
    
    // Screenshot 3: Spln section  
    console.log("3. Spln section (spaces in spec)...");
    const splnSection = page.locator('[data-testid="flc-section-Spln"]');
    await splnSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotDir, "final-fix-03-spln.png"),
      fullPage: false 
    });
    
    // Screenshot 4: Overview
    console.log("4. Overview of all sections...");
    await page.locator('[data-testid="flc-section-Hedr"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotDir, "final-fix-04-overview.png"),
      fullPage: true 
    });
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ All screenshots saved successfully!");
    console.log("=".repeat(70));
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await browser.close();
  }
}

createFinalScreenshots().catch(console.error);
