import { test } from '@playwright/test';

test('EarthFarm sample debugging test', async ({ page }) => {
  // Listen for console messages and errors
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('✅ Page loaded');
  
  const earthFarmButton = page.locator('button:has-text("Load EarthFarm Sample")');
  await earthFarmButton.click();
  console.log('✅ EarthFarm button clicked');
  
  // Wait longer for processing
  await page.waitForTimeout(10000);
  
  // Check for four-letter code sections with various selectors
  const fourLetterSectionsTestId = await page.locator('[data-testid="four-letter-code-section"]').count();
  const fourLetterSectionsAlt = await page.locator('div:has-text("Four-Letter Code")').count();
  const specificationsSection = await page.locator('text="Four-Letter Code Specifications"').count();
  
  console.log(`Four-letter code sections (data-testid): ${fourLetterSectionsTestId}`);
  console.log(`Four-letter sections (alt selector): ${fourLetterSectionsAlt}`);
  console.log(`Specifications section: ${specificationsSection}`);
  
  // Get full page text to analyze
  const bodyText = await page.textContent('body');
  console.log(`Full body text length: ${bodyText?.length || 0}`);
  
  // Search for specific patterns
  console.log('Contains "Conversion Error":', bodyText?.includes('Conversion Error') || false);
  console.log('Contains "Four-Letter":', bodyText?.includes('Four-Letter') || false);
  console.log('Contains four-letter codes (regex):', /[A-Z]{4}/.test(bodyText || ''));
  
  // Look for specific EarthFarm four-letter codes
  const earthFarmCodes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'];
  for (const code of earthFarmCodes) {
    const found = bodyText?.includes(code) || false;
    console.log(`Contains "${code}": ${found}`);
  }
  
  // Look for any error indicators
  const errorTexts = ['error', 'Error', 'ERROR', 'failed', 'Failed', 'FAILED'];
  for (const errorText of errorTexts) {
    const found = bodyText?.includes(errorText) || false;
    if (found) console.log(`⚠️ Contains "${errorText}": ${found}`);
  }
  
  // Print console messages and errors
  console.log('\n📋 Console messages:');
  consoleMessages.forEach(msg => console.log('  ', msg));
  
  if (pageErrors.length > 0) {
    console.log('\n❌ Page errors:');
    pageErrors.forEach(err => console.log('  ', err));
  }
  
  // Print a portion of the body text for manual analysis
  console.log('\n📄 Body text preview (characters 0-2000):');
  console.log(bodyText?.substring(0, 2000) || 'NO TEXT');
  
  console.log('\n📄 Body text end (last 1000 characters):');
  console.log(bodyText?.substring(Math.max(0, (bodyText?.length || 0) - 1000)) || 'NO TEXT');
  
  // Take a screenshot at the end for manual inspection
  await page.screenshot({ path: 'screenshots/debug-final-state.png', fullPage: true });
  console.log('📸 Screenshot saved to screenshots/debug-final-state.png');
});