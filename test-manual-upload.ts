import { chromium } from 'playwright';

async function testManualSpecUpload() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    console.log('=== Testing Manual Spec Upload ===');
    
    // Upload EarthFarm.ter.rsrc manually first
    const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
    await fileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
    await page.waitForTimeout(3000);
    
    console.log('EarthFarm.ter.rsrc uploaded');
    
    // Take screenshot before spec upload
    await page.screenshot({ path: 'screenshots/before-spec-upload.png', fullPage: true });
    
    // Check conversion errors before spec upload
    let conversionErrors = (await page.content()).match(/Conversion Error:/g) || [];
    console.log(`Before spec upload: ${conversionErrors.length} conversion errors`);
    
    // Expand specification management
    const specManagementTrigger = page.locator('text="Specification Management"').first();
    await specManagementTrigger.click();
    await page.waitForTimeout(1000);
    
    console.log('Specification Management expanded');
    
    // Look for the spec file input
    const specInputs = await page.locator('input[type="file"]').all();
    console.log(`Found ${specInputs.length} file inputs`);
    
    // Try to find the spec file input (not the .rsrc input)
    let specInput = null;
    for (const input of specInputs) {
      const accept = await input.getAttribute('accept');
      console.log(`Input accept attribute: ${accept}`);
      if (accept && (accept.includes('.txt') || accept.includes('.spec'))) {
        specInput = input;
        break;
      }
    }
    
    if (specInput) {
      console.log('Found spec file input, uploading otto-specs.txt...');
      await specInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
      await page.waitForTimeout(5000);
      
      // Take screenshot after spec upload
      await page.screenshot({ path: 'screenshots/after-spec-upload.png', fullPage: true });
      
      // Check conversion errors after spec upload
      conversionErrors = (await page.content()).match(/Conversion Error:/g) || [];
      console.log(`After spec upload: ${conversionErrors.length} conversion errors`);
      
      // Check if field specifications were loaded correctly
      const fourLetterCodes = ['Hedr', 'Atrb', 'Layr', 'Liqd'];
      for (const code of fourLetterCodes) {
        const section = page.locator(`[data-testid="flc-section-${code}"]`);
        if (await section.count() > 0) {
          const content = await section.textContent();
          const hasFields = content?.includes('field') || content?.includes('version') || content?.includes('type');
          const hasError = content?.includes('Conversion Error:');
          console.log(`${code}: Has proper fields=${hasFields}, Has error=${hasError}`);
        }
      }
    } else {
      console.log('Could not find spec file input');
      
      // List all buttons to see what's available
      const buttons = await page.locator('button').all();
      console.log('Available buttons:');
      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent();
        console.log(`${i + 1}. ${text?.trim()}`);
      }
    }
    
  } catch (error) {
    console.error('Error during manual spec upload test:', error);
  } finally {
    await browser.close();
  }
}

testManualSpecUpload().catch(console.error);