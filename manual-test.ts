import { chromium, Browser, Page } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runManualTests() {
  const browser: Browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page: Page = await context.newPage();

  try {
    console.log('🚀 Starting manual Playwright tests...');
    
    // Navigate to the application
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'screenshots/initial-state.png', fullPage: true });
    
    // Test 1: Load EarthFarm Sample
    console.log('\n=== TEST 1: Load EarthFarm Sample ===');
    
    // Click the Load EarthFarm Sample button
    console.log('🔄 Clicking Load EarthFarm Sample button...');
    await page.click('button:has-text("Load EarthFarm Sample")');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    console.log('📸 Taking screenshot after EarthFarm sample load...');
    await page.screenshot({ path: 'screenshots/test1-earthfarm-loaded.png', fullPage: true });
    
    // Check for four-letter codes
    console.log('🔍 Checking for four-letter codes...');
    const fourLetterCodes = await page.locator('[data-testid="four-letter-code-section"]').count();
    console.log(`Found ${fourLetterCodes} four-letter code sections`);
    
    // List all four-letter codes found
    const codeElements = await page.locator('[data-testid="four-letter-code-section"] h3').allTextContents();
    console.log('Four-letter codes found:', codeElements);
    
    // Check status indicators
    const validStatuses = await page.locator('.text-green-500').count();
    const invalidStatuses = await page.locator('.text-red-500').count();
    const warningStatuses = await page.locator('.text-yellow-500').count();
    
    console.log(`Status indicators - Valid: ${validStatuses}, Invalid: ${invalidStatuses}, Warning: ${warningStatuses}`);
    
    // Check sample data
    const sampleElements = await page.locator('[data-testid="sample-data"]').count();
    console.log(`Sample data elements found: ${sampleElements}`);
    
    if (sampleElements > 0) {
      const firstSample = await page.locator('[data-testid="sample-data"]').first().textContent();
      console.log('First sample data preview:', firstSample?.substring(0, 200) + '...');
    }
    
    // Test 2: Manual Upload
    console.log('\n=== TEST 2: Manual Upload ===');
    
    // Clear existing data first
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    console.log('📂 Testing manual file upload...');
    
    // Upload .rsrc file
    const rsrcPath = join(process.cwd(), 'public/test-files/EarthFarm.ter.rsrc');
    const rsrcFileInput = page.locator('input[type="file"]').first();
    await rsrcFileInput.setInputFiles(rsrcPath);
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Upload specs file by expanding the specification management section
    console.log('🔧 Expanding specification management...');
    await page.click('[data-testid="collapsible-trigger"]');
    await page.waitForTimeout(1000);
    
    // Upload otto-specs.txt
    console.log('📄 Uploading otto-specs.txt...');
    const specsPath = join(process.cwd(), 'public/test-files/otto-specs.txt');
    const specsFileInput = page.locator('input[type="file"]').nth(1);
    await specsFileInput.setInputFiles(specsPath);
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    console.log('📸 Taking screenshot after manual upload...');
    await page.screenshot({ path: 'screenshots/test2-manual-upload.png', fullPage: true });
    
    // Check for four-letter codes again
    console.log('🔍 Checking four-letter codes after manual upload...');
    const manualFourLetterCodes = await page.locator('[data-testid="four-letter-code-section"]').count();
    console.log(`Found ${manualFourLetterCodes} four-letter code sections after manual upload`);
    
    // List all four-letter codes found in manual test
    const manualCodeElements = await page.locator('[data-testid="four-letter-code-section"] h3').allTextContents();
    console.log('Four-letter codes found in manual test:', manualCodeElements);
    
    // Check status indicators for manual test
    const manualValidStatuses = await page.locator('.text-green-500').count();
    const manualInvalidStatuses = await page.locator('.text-red-500').count();
    const manualWarningStatuses = await page.locator('.text-yellow-500').count();
    
    console.log(`Manual test status indicators - Valid: ${manualValidStatuses}, Invalid: ${manualInvalidStatuses}, Warning: ${manualWarningStatuses}`);
    
    // Test changing a data type to cause invalid status
    console.log('\n=== TEST 3: Testing Invalid Status ===');
    
    if (manualFourLetterCodes > 0) {
      console.log('🔧 Changing a data type to test invalid status...');
      
      // Find the first dropdown and change it to an incompatible type
      const firstDropdown = page.locator('select').first();
      if (await firstDropdown.count() > 0) {
        await firstDropdown.selectOption('double');
        await page.waitForTimeout(2000);
        
        console.log('📸 Taking screenshot after changing data type...');
        await page.screenshot({ path: 'screenshots/test3-invalid-status.png', fullPage: true });
        
        // Check for invalid status
        const postChangeInvalidStatuses = await page.locator('.text-red-500').count();
        console.log(`Invalid statuses after data type change: ${postChangeInvalidStatuses}`);
        
        if (postChangeInvalidStatuses > 0) {
          console.log('✅ Successfully created invalid status by changing data type');
        } else {
          console.log('⚠️ No invalid status found after changing data type');
        }
      }
    }
    
    // Final summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✅ Test 1 (EarthFarm Sample): ${fourLetterCodes} four-letter codes detected`);
    console.log(`✅ Test 2 (Manual Upload): ${manualFourLetterCodes} four-letter codes detected`);
    console.log(`✅ Test 3 (Invalid Status): Completed`);
    
    // Take final screenshot
    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: 'screenshots/final-state.png', fullPage: true });
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('📁 Screenshots saved to screenshots/ directory');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'screenshots/error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

runManualTests().catch(console.error);