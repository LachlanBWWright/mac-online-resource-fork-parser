import { chromium } from 'playwright';

async function findConversionErrors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Finding Conversion Errors ===');
    
    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/conversion-errors-search.png', fullPage: true });
    
    // Search for conversion errors in the page content
    const pageContent = await page.content();
    
    // Find all instances of "Conversion Error:" or "conversionError"
    const conversionErrorMatches = pageContent.match(/Conversion Error:|conversionError|conversion error/gi) || [];
    console.log(`Found ${conversionErrorMatches.length} conversion error references in page`);
    
    // Look for specific error patterns
    const errorRegex = /"conversionError":\s*"([^"]+)"/g;
    let match;
    const errors = [];
    while ((match = errorRegex.exec(pageContent)) !== null) {
      errors.push(match[1]);
    }
    
    console.log(`Extracted ${errors.length} specific conversion errors:`);
    errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
    
    // Also check for any text containing "Error"
    const allErrorElements = await page.locator('text=/Error/i').all();
    console.log(`\nFound ${allErrorElements.length} elements containing "Error":`);
    
    for (let i = 0; i < Math.min(10, allErrorElements.length); i++) {
      const errorText = await allErrorElements[i].textContent();
      console.log(`${i + 1}. ${errorText?.substring(0, 100)}...`);
    }
    
    // Look for specific four-letter codes with errors
    const fourLetterCodes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'];
    
    console.log('\n=== Four-Letter Code Status ===');
    for (const code of fourLetterCodes) {
      const section = page.locator(`[data-testid="flc-section-${code}"]`);
      if (await section.count() > 0) {
        const hasError = (await section.textContent())?.includes('Conversion Error:') || false;
        const hasValidIcon = await section.locator('svg.text-green-500').count() > 0;
        const hasErrorIcon = await section.locator('svg.text-red-500').count() > 0;
        const hasWarningIcon = await section.locator('svg.text-yellow-500').count() > 0;
        
        console.log(`${code}: Error=${hasError}, Valid=${hasValidIcon}, Error=${hasErrorIcon}, Warning=${hasWarningIcon}`);
      }
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
  }
}

findConversionErrors().catch(console.error);