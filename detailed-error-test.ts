import { chromium } from 'playwright';

async function detailedErrorAnalysis() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Detailed Conversion Error Analysis ===');
    
    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/detailed-error-analysis.png', fullPage: true });
    
    // Get all four-letter code sections
    const flcSections = await page.locator('[data-testid^="flc-section-"]').all();
    console.log(`Found ${flcSections.length} four-letter code sections:`);
    
    for (let i = 0; i < flcSections.length; i++) {
      const section = flcSections[i];
      
      // Get the four-letter code name
      const codeTitle = await section.locator('h3').textContent();
      
      // Check for status
      const statusIcon = await section.locator('[data-testid="status-icon"]').textContent();
      
      // Check for conversion errors in this section
      const conversionErrorText = await section.locator('text="Conversion Error:"').count();
      const hasConversionError = conversionErrorText > 0;
      
      // Get sample data
      const sampleData = await section.locator('[data-testid="sample-data"]').textContent();
      
      console.log(`${i + 1}. ${codeTitle?.trim()}`);
      console.log(`   Status: ${statusIcon?.trim()}`);
      console.log(`   Has conversion error: ${hasConversionError}`);
      console.log(`   Sample: ${sampleData?.substring(0, 100)}...`);
      
      if (hasConversionError) {
        // Get the full error text
        const errorElement = await section.locator('text="Conversion Error:"').first();
        const errorText = await errorElement.textContent();
        console.log(`   ERROR DETAILS: ${errorText}`);
      }
      console.log('');
    }
    
    // Also test manual spec upload
    console.log('\n=== Testing Manual Spec Upload ===');
    
    // Reload page first
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Upload EarthFarm.ter.rsrc manually
    const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
    await fileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    await page.waitForTimeout(3000);
    
    // Expand specification management
    const specManagementButton = page.locator('button:has-text("Specification Management")');
    if (await specManagementButton.count() > 0) {
      await specManagementButton.click();
      await page.waitForTimeout(1000);
      
      // Upload spec file
      const specInput = page.locator('input[type="file"][accept=".txt,.spec"]');
      if (await specInput.count() > 0) {
        await specInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
        await page.waitForTimeout(3000);
        
        // Take screenshot
        await page.screenshot({ path: 'screenshots/manual-spec-upload-test.png', fullPage: true });
        
        // Check conversion errors again
        const manualErrors = (await page.content()).match(/Conversion Error:/g) || [];
        console.log(`After manual spec upload: Found ${manualErrors.length} conversion errors`);
      }
    }
    
  } catch (error) {
    console.error('Error during detailed analysis:', error);
  } finally {
    await browser.close();
  }
}

detailedErrorAnalysis().catch(console.error);