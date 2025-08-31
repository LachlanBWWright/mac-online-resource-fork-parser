import { chromium } from 'playwright';

async function quickTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('Page loaded successfully');
    
    // Take a basic screenshot
    await page.screenshot({ path: 'screenshots/initial-page.png', fullPage: true });
    
    // Get the page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Check if EarthFarm button exists
    const earthFarmButton = await page.locator('button:has-text("Load EarthFarm Sample")').count();
    console.log(`EarthFarm button found: ${earthFarmButton > 0}`);
    
    if (earthFarmButton > 0) {
      console.log('Clicking EarthFarm button...');
      await page.click('button:has-text("Load EarthFarm Sample")');
      await page.waitForTimeout(5000);
      
      // Take screenshot after loading
      await page.screenshot({ path: 'screenshots/after-earthfarm-load.png', fullPage: true });
      
      // Check page content for errors
      const pageContent = await page.content();
      const conversionErrorCount = (pageContent.match(/Conversion Error:/g) || []).length;
      console.log(`Found ${conversionErrorCount} conversion errors in page content`);
      
      // Check for four-letter code sections
      const sections = await page.locator('[data-testid^="flc-section-"]').count();
      console.log(`Found ${sections} four-letter code specification sections`);
      
      // Try to find any h3 elements that might be four-letter codes
      const h3Elements = await page.locator('h3').all();
      console.log(`Found ${h3Elements.length} h3 elements:`);
      for (let i = 0; i < h3Elements.length; i++) {
        const text = await h3Elements[i].textContent();
        console.log(`  H3 ${i + 1}: ${text}`);
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);