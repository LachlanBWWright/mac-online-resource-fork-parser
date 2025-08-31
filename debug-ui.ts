import { chromium } from 'playwright';

async function debugUIRendering() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Debugging UI Rendering ===');
    
    // Load EarthFarm Sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(8000); // Give more time
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/debug-ui-rendering.png', fullPage: true });
    
    // Check for h3 elements (four-letter code titles)
    const h3Elements = await page.locator('h3').all();
    console.log(`Found ${h3Elements.length} h3 elements:`);
    for (let i = 0; i < h3Elements.length; i++) {
      const text = await h3Elements[i].textContent();
      console.log(`  H3 ${i + 1}: ${text}`);
    }
    
    // Check for any elements with data-testid starting with "flc-section"
    const flcElements = await page.locator('[data-testid^="flc-section"]').all();
    console.log(`\nFound ${flcElements.length} flc-section elements`);
    
    // Check for any div elements with data-testid
    const allTestIds = await page.locator('[data-testid]').all();
    console.log(`\nFound ${allTestIds.length} elements with data-testid:`);
    for (let i = 0; i < Math.min(10, allTestIds.length); i++) {
      const testId = await allTestIds[i].getAttribute('data-testid');
      const text = await allTestIds[i].textContent();
      console.log(`  ${testId}: ${text?.substring(0, 50)}...`);
    }
    
    // Search for specific patterns in page content
    const pageContent = await page.content();
    const hasHedr = pageContent.includes('Hedr');
    const hasLiqd = pageContent.includes('Liqd');
    const hasConversionError = pageContent.includes('Conversion Error');
    const hasValidIcon = pageContent.includes('text-green-500');
    
    console.log(`\nPage content analysis:`);
    console.log(`  Contains 'Hedr': ${hasHedr}`);
    console.log(`  Contains 'Liqd': ${hasLiqd}`);
    console.log(`  Contains 'Conversion Error': ${hasConversionError}`);
    console.log(`  Contains valid icons: ${hasValidIcon}`);
    
    // Check if the four-letter codes are being loaded in React state
    const fourLetterCodeSectionExists = await page.locator('text="Four-Letter Code Specifications"').count() > 0;
    console.log(`\n"Four-Letter Code Specifications" section exists: ${fourLetterCodeSectionExists}`);
    
    if (fourLetterCodeSectionExists) {
      // Check what comes after that section
      const sectionContent = await page.locator('text="Four-Letter Code Specifications"').locator('..').textContent();
      console.log(`Section content: ${sectionContent?.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error('Error during UI debugging:', error);
  } finally {
    await browser.close();
  }
}

debugUIRendering().catch(console.error);