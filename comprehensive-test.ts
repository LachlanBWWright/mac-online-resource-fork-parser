import { chromium } from 'playwright';

async function comprehensiveTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Comprehensive EarthFarm Test ===');
    
    // Test 1: Load EarthFarm Sample
    console.log('\n1. Loading EarthFarm Sample...');
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/final-earthfarm-test.png', fullPage: true });
    
    // Check conversion errors
    const conversionErrors = (await page.content()).match(/Conversion Error:/g) || [];
    console.log(`   Conversion errors: ${conversionErrors.length}`);
    
    // Check four-letter code sections
    const flcSections = await page.locator('[data-testid^="flc-section-"]').count();
    console.log(`   Four-letter code sections: ${flcSections}`);
    
    // List all four-letter codes and their status
    const fourLetterCodes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'];
    let validCodes = 0;
    let errorCodes = 0;
    
    for (const code of fourLetterCodes) {
      const section = page.locator(`[data-testid="flc-section-${code}"]`);
      if (await section.count() > 0) {
        const hasError = (await section.textContent())?.includes('Conversion Error:') || false;
        const hasValidIcon = await section.locator('svg.text-green-500').count() > 0;
        
        if (hasError) {
          errorCodes++;
          console.log(`   ${code}: ERROR`);
        } else if (hasValidIcon) {
          validCodes++;
          console.log(`   ${code}: VALID`);
        } else {
          console.log(`   ${code}: UNKNOWN`);
        }
      } else {
        console.log(`   ${code}: NOT FOUND`);
      }
    }
    
    console.log(`\n   Summary: ${validCodes} valid, ${errorCodes} errors`);
    
    // Test 2: Manual upload test
    console.log('\n2. Testing Manual Upload...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Upload EarthFarm.ter.rsrc manually
    const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
    await fileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    await page.waitForTimeout(3000);
    
    // Expand specification management and upload specs
    await page.click('text="Specification Management"');
    await page.waitForTimeout(1000);
    
    const specInput = page.locator('input[type="file"][accept=".txt"]');
    await specInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
    await page.waitForTimeout(3000);
    
    // Check conversion errors after manual upload
    const manualErrors = (await page.content()).match(/Conversion Error:/g) || [];
    console.log(`   Manual upload conversion errors: ${manualErrors.length}`);
    
    // Test field initialization - check if field names are properly shown
    const hedrSection = page.locator('[data-testid="flc-section-Hedr"]');
    if (await hedrSection.count() > 0) {
      const hedrContent = await hedrSection.textContent();
      const hasVersionField = hedrContent?.includes('version') || false;
      const hasNumItemsField = hedrContent?.includes('numItems') || false;
      console.log(`   Hedr fields properly initialized: version=${hasVersionField}, numItems=${hasNumItemsField}`);
    }
    
    // Test Liqd array field
    const liqdSection = page.locator('[data-testid="flc-section-Liqd"]');
    if (await liqdSection.count() > 0) {
      const liqdContent = await liqdSection.textContent();
      const hasArrayField = liqdContent?.includes('x`y[100]') || liqdContent?.includes('x_y') || false;
      console.log(`   Liqd array field properly initialized: ${hasArrayField}`);
    }
    
    console.log('\n=== Test Results ===');
    if (conversionErrors.length === 0 && manualErrors.length === 0 && validCodes >= 13) {
      console.log('✅ ALL TESTS PASSED');
      console.log('✅ EarthFarm sample loads without conversion errors');
      console.log('✅ Manual spec upload works correctly');
      console.log('✅ Four-letter codes are properly detected and validated');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log(`   EarthFarm errors: ${conversionErrors.length}`);
      console.log(`   Manual upload errors: ${manualErrors.length}`);
      console.log(`   Valid codes: ${validCodes}`);
    }
    
  } catch (error) {
    console.error('Error during comprehensive test:', error);
  } finally {
    await browser.close();
  }
}

comprehensiveTest().catch(console.error);